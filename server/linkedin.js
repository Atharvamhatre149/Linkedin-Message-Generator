// ─────────────────────────────────────────────────────────────
//  server/linkedin.js
//  Playwright-driven LinkedIn automation.
//
//  Public surface (all async):
//    • hasSession()                   → boolean
//    • login()                        → { success, error? }
//    • lookupCompany(name)            → { id, name, url } | null
//    • searchConnections(opts)        → [{ name, title, profileUrl, avatar }]
//    • sendMessage(profileUrl, text)  → { success, error? }
//
//  All calls share a single Chromium instance kept alive between
//  requests to avoid cold-start overhead. The browser is launched
//  lazily on the first request and gracefully closed on process exit.
// ─────────────────────────────────────────────────────────────

import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SESSION_PATH = path.join(__dirname, '.session.json')

// Delay helpers — LinkedIn is sensitive to fast, bot-like actions.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const jitter = (min, max) => Math.floor(min + Math.random() * (max - min))

// ── Debug / visibility flags ─────────────────────────────────
// LINKEDIN_HEADED=1       → run the shared browser visible (see every step)
// LINKEDIN_SLOWMO=500     → slow every Playwright action by N ms
// LINKEDIN_DEVTOOLS=1     → open DevTools alongside the window (implies headed)
const truthy = (v) => /^(1|true|yes|on)$/i.test(String(v || ''))
const DEBUG = {
  headed: truthy(process.env.LINKEDIN_HEADED) || truthy(process.env.LINKEDIN_DEVTOOLS),
  slowMo: Number(process.env.LINKEDIN_SLOWMO || 0) || 0,
  devtools: truthy(process.env.LINKEDIN_DEVTOOLS),
}
if (DEBUG.headed || DEBUG.slowMo) {
  console.log(
    '[linkedin] debug mode →',
    `headed=${DEBUG.headed}`,
    `slowMo=${DEBUG.slowMo}ms`,
    `devtools=${DEBUG.devtools}`
  )
}

// ── Lifecycle ────────────────────────────────────────────────
let browserPromise = null

function getBrowser({ headless = !DEBUG.headed } = {}) {
  if (browserPromise) return browserPromise
  browserPromise = chromium.launch({
    headless,
    slowMo: DEBUG.slowMo,
    devtools: DEBUG.devtools,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-dev-shm-usage',
    ],
  })
  return browserPromise
}

async function newContext({ headless = !DEBUG.headed } = {}) {
  const browser = await getBrowser({ headless })
  const opts = {
    viewport: { width: 1366, height: 820 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    locale: 'en-US',
  }
  if (fs.existsSync(SESSION_PATH)) opts.storageState = SESSION_PATH
  return browser.newContext(opts)
}

async function saveSession(context) {
  await context.storageState({ path: SESSION_PATH })
}

/**
 * Same as saveSession but refuses to persist the context's state when the
 * context no longer holds a valid `li_at` cookie.
 *
 * This is important because LinkedIn sometimes strips auth cookies when it
 * redirects us to /authwall or rate-limits a request. Without this guard,
 * a brief redirect during a lookup/search would overwrite the good
 * .session.json on disk with an empty one — the user would appear logged
 * out within seconds of a single failed Playwright action.
 *
 * Returns true if it wrote, false if it skipped.
 */
async function saveSessionIfValid(context) {
  try {
    const cookies = await context.cookies('https://www.linkedin.com')
    const liAt = cookies.find((c) => c.name === 'li_at')
    if (!liAt || !liAt.value || liAt.value.length < 20) {
      console.warn(
        '[linkedin] skipping session save — context has no valid li_at ' +
          '(likely hit authwall/rate-limit). Keeping existing .session.json.'
      )
      return false
    }
    await context.storageState({ path: SESSION_PATH })
    return true
  } catch (e) {
    console.warn('[linkedin] saveSessionIfValid failed:', e?.message)
    return false
  }
}

// Closes the shared browser. Call from a SIGINT handler in vite.config.js.
export async function shutdown() {
  if (!browserPromise) return
  try {
    const b = await browserPromise
    await b.close()
  } catch {
    /* ignore */
  }
  browserPromise = null
}

// ── Auth ─────────────────────────────────────────────────────
export function hasSession() {
  return fs.existsSync(SESSION_PATH)
}

export function clearSession() {
  try {
    if (fs.existsSync(SESSION_PATH)) fs.unlinkSync(SESSION_PATH)
    return true
  } catch {
    return false
  }
}

/**
 * Opens a visible Chromium window for the user to log into LinkedIn.
 * Resolves once we see /feed (i.e. login succeeded), then persists the
 * session state to disk so subsequent calls can run headless.
 */
export async function login({ timeoutMs = 180_000 } = {}) {
  // We need a fresh headed browser for this — reuse would conflict if the
  // shared one is headless.  Launch a dedicated instance.
  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded' })

    // The definitive "logged in" signal is the presence of the `li_at` cookie.
    // URL-based detection is unreliable (checkpoint bounces, /in/ matches in
    // other paths, user may navigate around before closing). So we poll the
    // cookie jar until it shows up.
    const deadline = Date.now() + timeoutMs
    let liAt = null
    while (Date.now() < deadline) {
      const cookies = await context.cookies('https://www.linkedin.com')
      liAt = cookies.find((c) => c.name === 'li_at')
      if (liAt && liAt.value && liAt.value.length > 20) break
      await page.waitForTimeout(1_000)
    }

    if (!liAt) {
      await browser.close().catch(() => {})
      return { success: false, error: 'login_timeout_no_li_at' }
    }

    // Give any in-flight session handshakes a brief moment to finish before
    // persisting state.
    await page.waitForTimeout(1_500)

    await saveSession(context)
    await browser.close()
    return { success: true }
  } catch (e) {
    await browser.close().catch(() => {})
    return { success: false, error: e?.message || 'login_timeout' }
  }
}

/**
 * Cheap local check: does the saved session file contain a plausible
 * `li_at` cookie?
 *
 * We deliberately do NOT hit LinkedIn's `/feed` here even though that
 * would give a definitive yes/no. Two reasons:
 *   1. /api/auth/status is called on every UI mount; a network probe
 *      every time adds seconds to the first render.
 *   2. Every automated hit to LinkedIn contributes to bot-scoring —
 *      and since the next real operation (lookup/search/send) will
 *      return `auth_expired` anyway if the server invalidated the
 *      session, the extra probe buys us nothing.
 *
 * If you ever want a full network probe, call `deepVerifySession()`.
 */
export async function verifySession() {
  if (!hasSession()) return { valid: false, reason: 'no_session' }
  try {
    const raw = fs.readFileSync(SESSION_PATH, 'utf8')
    const parsed = JSON.parse(raw)
    const liAt = (parsed.cookies || []).find(
      (c) => c.name === 'li_at' && c.value && c.value.length > 20
    )
    if (!liAt) return { valid: false, reason: 'missing_li_at' }
    // Also check cookie expiry — LinkedIn sets ~1 year; if it's in the past
    // the cookie is dead even if it exists.
    if (liAt.expires && liAt.expires > 0 && liAt.expires * 1000 < Date.now()) {
      return { valid: false, reason: 'li_at_expired' }
    }
    return { valid: true, reason: 'ok_file' }
  } catch {
    return { valid: false, reason: 'session_unreadable' }
  }
}

/**
 * Optional: full network-round-trip probe for when the user explicitly
 * asks to verify (e.g. after a long pause). Not called automatically.
 */
export async function deepVerifySession() {
  const cheap = await verifySession()
  if (!cheap.valid) return cheap
  const context = await newContext()
  const page = await context.newPage()
  try {
    await page.goto('https://www.linkedin.com/feed/', {
      waitUntil: 'domcontentloaded',
      timeout: 15_000,
    })
    const valid = /linkedin\.com\/feed/.test(page.url())
    return {
      valid,
      reason: valid ? 'ok_network' : 'redirected_to_' + new URL(page.url()).pathname,
    }
  } catch (e) {
    return { valid: false, reason: e?.message || 'probe_failed' }
  } finally {
    await context.close().catch(() => {})
  }
}

// ── Company ID lookup ────────────────────────────────────────
// URN patterns that LinkedIn embeds in its JSON payloads / HTML.
// Listed from most specific to least; first match wins.
const COMPANY_URN_PATTERNS = [
  /urn:li:fsd_company:(\d+)/,
  /urn:li:fs_company:(\d+)/,
  /urn:li:company:(\d+)/,
]

const authExpiredError = () => {
  const err = new Error('auth_expired')
  err.code = 'auth_expired'
  return err
}

/**
 * Extract the CSRF token LinkedIn expects on Voyager API calls.
 * It's just the JSESSIONID cookie value with surrounding quotes stripped.
 */
async function getCsrfToken(context) {
  const cookies = await context.cookies('https://www.linkedin.com')
  const js = cookies.find((c) => c.name === 'JSESSIONID')
  if (!js) return null
  return js.value.replace(/^"+|"+$/g, '')
}

/**
 * Primary lookup path: the Voyager typeahead API.
 * This is the same endpoint the "Add a company" input in the people-search
 * facet dropdown calls, so its results include the exact numeric IDs that
 * LinkedIn itself uses for currentCompany=[] filters.
 */
async function lookupViaTypeahead(context, name) {
  const csrf = await getCsrfToken(context)
  if (!csrf) throw authExpiredError()

  const keywords = encodeURIComponent(name.trim())
  const url =
    'https://www.linkedin.com/voyager/api/typeahead/hitsV2' +
    `?keywords=${keywords}` +
    '&q=blended' +
    '&origin=FACETED_SEARCH' +
    '&types=List(COMPANY)'

  const resp = await context.request.get(url, {
    headers: {
      'Csrf-Token': csrf,
      'Accept': 'application/vnd.linkedin.normalized+json+2.1',
      'x-li-lang': 'en_US',
      'x-restli-protocol-version': '2.0.0',
      Referer: 'https://www.linkedin.com/search/results/people/',
    },
    timeout: 12_000,
  })

  if (resp.status() === 401 || resp.status() === 403) throw authExpiredError()
  if (!resp.ok()) return null

  const data = await resp.json().catch(() => null)
  if (!data) return null

  // Voyager response shape varies; scan every element for a company URN.
  const allElements = [
    ...(Array.isArray(data.elements) ? data.elements : []),
    ...(Array.isArray(data.included) ? data.included : []),
  ]

  for (const el of allElements) {
    const urnSources = [
      el.targetUrn,
      el.objectUrn,
      el.trackingUrn,
      el.entityLockupView?.navigationUrl,
      el.entityLockupView?.actorUrn,
      el.image?.attributes?.[0]?.sourceType,
    ].filter(Boolean)

    for (const src of urnSources) {
      for (const pat of COMPANY_URN_PATTERNS) {
        const m = String(src).match(pat)
        if (m) {
          const displayName =
            el.title?.text ||
            el.primarySubtitle?.text ||
            el.entityLockupView?.title?.text ||
            name.trim()
          return {
            id: m[1],
            name: displayName,
            url: `https://www.linkedin.com/company/${m[1]}/`,
            source: 'typeahead',
          }
        }
      }
    }
  }
  return null
}

/**
 * Fallback lookup path: open the people-search UI, click the
 * "Current company" facet, type the name into "Add a company", and
 * capture the typeahead response the browser itself fires.
 * Slower than the direct API call but survives API shape changes.
 */
async function lookupViaUiFacet(context, name) {
  const page = await context.newPage()
  try {
    await page.goto(
      'https://www.linkedin.com/search/results/people/?network=%5B%22F%22%5D',
      { waitUntil: 'domcontentloaded', timeout: 20_000 }
    )
    if (/\/(login|authwall|checkpoint)/.test(page.url())) {
      throw authExpiredError()
    }
    await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {})

    // Open the "Current company" filter.
    const facetBtn = page
      .locator('button:has-text("Current company"), button:has-text("Current companies")')
      .first()
    await facetBtn.waitFor({ timeout: 8_000 })
    await facetBtn.click()

    // Wait for the dropdown's search input (placeholder "Add a company").
    const searchInput = page
      .locator(
        'input[placeholder*="Add a company" i], ' +
          'input[placeholder*="Search by company" i], ' +
          'input[aria-label*="company" i]'
      )
      .first()
    await searchInput.waitFor({ timeout: 8_000 })

    // Capture the typeahead response as the user types.
    const responsePromise = page
      .waitForResponse(
        (r) => /typeahead/i.test(r.url()) && r.status() === 200,
        { timeout: 12_000 }
      )
      .catch(() => null)

    await searchInput.fill('')
    await searchInput.type(name.trim(), { delay: _internal.jitter(40, 90) })

    const response = await responsePromise
    if (!response) return null
    const data = await response.json().catch(() => null)
    if (!data) return null

    const elements = [
      ...(Array.isArray(data.elements) ? data.elements : []),
      ...(Array.isArray(data.included) ? data.included : []),
    ]
    for (const el of elements) {
      const urnSources = [el.targetUrn, el.objectUrn, el.trackingUrn].filter(Boolean)
      for (const src of urnSources) {
        for (const pat of COMPANY_URN_PATTERNS) {
          const m = String(src).match(pat)
          if (m) {
            const displayName =
              el.title?.text ||
              el.primarySubtitle?.text ||
              name.trim()
            return {
              id: m[1],
              name: displayName,
              url: `https://www.linkedin.com/company/${m[1]}/`,
              source: 'ui_facet',
            }
          }
        }
      }
    }
    return null
  } finally {
    await page.close().catch(() => {})
  }
}

/**
 * Public entry point. Tries the direct Voyager typeahead first; if that
 * returns nothing (or fails with a non-auth error), falls back to driving
 * the people-search UI — the same flow a user would do manually.
 *
 * Returns { id, name, url, source } or null.
 * Throws { code: 'auth_expired' } when the session is dead.
 */
export async function lookupCompany(name) {
  if (!name || !name.trim()) return null
  if (!hasSession()) throw authExpiredError()

  const context = await newContext()
  try {
    // 1. Fast path — direct typeahead API
    try {
      const viaApi = await lookupViaTypeahead(context, name)
      if (viaApi) return viaApi
    } catch (e) {
      if (e?.code === 'auth_expired') throw e
      // otherwise silently fall through to UI path
    }

    // 2. Slow path — drive the UI facet search
    const viaUi = await lookupViaUiFacet(context, name)
    return viaUi
  } finally {
    await saveSessionIfValid(context).catch(() => {})
    await context.close().catch(() => {})
  }
}

// ── People search ────────────────────────────────────────────
/**
 * Search LinkedIn people with optional company + network filters.
 * Input:
 *   companyId        — numeric LinkedIn company ID (preferred for accuracy)
 *   companyName      — fallback keyword when no ID available
 *   filterKeywords   — extra keyword (e.g. "recruiter", "engineering manager")
 *   connectionsOnly  — if true, restrict to 1st-degree connections (network=["F"])
 *   limit            — max results to return (default 10, LinkedIn shows ~10/page)
 * Returns: array of { name, title, profileUrl, avatar, connectionDegree }
 */
export async function searchConnections({
  companyId = '',
  companyName = '',
  filterKeywords = '',
  connectionsOnly = true,
  limit = 10,
} = {}) {
  if (!hasSession()) {
    const err = new Error('auth_expired')
    err.code = 'auth_expired'
    throw err
  }

  const params = new URLSearchParams()
  if (companyId) {
    params.set('origin', 'FACETED_SEARCH')
    params.set('currentCompany', `["${companyId}"]`)
    if (filterKeywords) params.set('keywords', filterKeywords)
  } else {
    const q = filterKeywords
      ? `${filterKeywords} ${companyName}`.trim()
      : companyName.trim()
    params.set('keywords', q)
    params.set('origin', 'GLOBAL_SEARCH_HEADER')
  }
  if (connectionsOnly) params.set('network', '["F"]')

  const url = `https://www.linkedin.com/search/results/people/?${params.toString()}`

  const context = await newContext()
  const page = await context.newPage()

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20_000 })
    if (/\/(login|authwall|checkpoint)/.test(page.url())) {
      const err = new Error('auth_expired')
      err.code = 'auth_expired'
      throw err
    }

    // Let Voyager hydrate the result list. Some A/B layouts don't emit
    // networkidle quickly, so we wait for any of a few known containers
    // and fall back to a fixed delay.
    const containerSelectors = [
      'ul[role="list"] li .entity-result',
      '.reusable-search__result-container',
      '[data-chameleon-result-urn]',
      '.search-results__list li',
    ].join(', ')
    await page.waitForSelector(containerSelectors, { timeout: 10_000 }).catch(() => {})
    await page.waitForTimeout(_internal.jitter(600, 1400))

    // Scroll once to coax lazy-rendering (LinkedIn hides results below fold).
    await page
      .evaluate(() => window.scrollBy(0, window.innerHeight))
      .catch(() => {})
    await page.waitForTimeout(_internal.jitter(400, 900))

    const results = await page.evaluate((max) => {
      const out = []
      const cards = document.querySelectorAll(
        [
          '[data-chameleon-result-urn]',
          '.reusable-search__result-container',
          'ul[role="list"] li',
        ].join(', ')
      )
      const seen = new Set()
      for (const card of cards) {
        if (out.length >= max) break

        // Profile link — must contain /in/
        const link = card.querySelector('a[href*="/in/"]')
        if (!link) continue
        const profileUrl = link.href.split('?')[0].replace(/\/$/, '')
        if (seen.has(profileUrl)) continue
        seen.add(profileUrl)

        const nameEl = card.querySelector(
          'span[dir="ltr"] span[aria-hidden="true"], ' +
            '.entity-result__title-text a span[aria-hidden="true"], ' +
            '.entity-result__title-text'
        )
        const titleEl = card.querySelector(
          '.entity-result__primary-subtitle, ' +
            '.t-14.t-black.t-normal, ' +
            'div.t-14.t-normal'
        )
        const degreeEl = card.querySelector(
          '.entity-result__badge-text, ' +
            '.dist-value, ' +
            '.distance-badge'
        )
        const avatarEl = card.querySelector(
          'img.presence-entity__image, ' +
            'img.EntityPhoto-circle-4, ' +
            'img[alt*="Photo"], ' +
            'img'
        )

        const name = nameEl?.textContent?.trim() || ''
        if (!name || /^LinkedIn Member$/i.test(name)) continue  // skip private profiles

        out.push({
          name,
          title: titleEl?.textContent?.trim() || '',
          profileUrl,
          avatar: avatarEl?.src || '',
          connectionDegree: degreeEl?.textContent?.trim() || '',
        })
      }
      return out
    }, limit)

    return results
  } finally {
    await saveSessionIfValid(context).catch(() => {})
    await context.close().catch(() => {})
  }
}

// ── Message sending ──────────────────────────────────────────
/**
 * Sends `text` to the LinkedIn profile at `profileUrl`.
 * Only works for 1st-degree connections (or Premium InMail, which
 * this helper does not try to use).
 *
 * Options:
 *   dryRun — if true, opens the overlay and types but skips the
 *            final Send click; useful for sanity-checking a batch.
 *
 * Returns:
 *   { success: true, sentAt }  on a confirmed send
 *   { success: false, error }  otherwise; error is one of:
 *     profile_not_found | not_1st_degree_or_no_button |
 *     overlay_failed    | input_rejected | send_verify_failed |
 *     challenge_triggered
 */
export async function sendMessage(profileUrl, text, { dryRun = false } = {}) {
  if (!profileUrl || !text) {
    return { success: false, error: 'missing_fields' }
  }
  if (!hasSession()) {
    const err = new Error('auth_expired')
    err.code = 'auth_expired'
    throw err
  }

  const context = await newContext()
  const page = await context.newPage()

  try {
    // 1. Navigate to profile
    await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 25_000 })

    // Session / challenge checks
    if (/\/(login|authwall|uas\/login)/.test(page.url())) {
      const err = new Error('auth_expired')
      err.code = 'auth_expired'
      throw err
    }
    if (/\/(checkpoint|challenge)/.test(page.url())) {
      return { success: false, error: 'challenge_triggered' }
    }

    // Give the profile a moment to settle (avatar, actions bar).
    await page.waitForTimeout(_internal.jitter(1200, 2200))

    // Detect 404-style "profile not found" pages.
    const is404 = await page
      .evaluate(() => /profile is not available|page isn't available|page doesn't exist/i
        .test(document.body.innerText || ''))
      .catch(() => false)
    if (is404) return { success: false, error: 'profile_not_found' }

    // 2. Find and click the Message button. We try multiple selectors
    //    because LinkedIn A/B-tests the profile header heavily.
    const messageButton = page
      .locator(
        [
          'main button[aria-label^="Message"]:not([disabled])',
          'main a[aria-label^="Message"]',
          'main button:has-text("Message"):not([disabled])',
          '.pvs-profile-actions button:has-text("Message")',
          'button.message-anywhere-button',
        ].join(', ')
      )
      .first()

    const found = await messageButton.waitFor({ timeout: 8_000 }).then(
      () => true,
      () => false
    )
    if (!found) return { success: false, error: 'not_1st_degree_or_no_button' }

    await page.waitForTimeout(_internal.jitter(400, 900))
    await messageButton.click().catch(() => {})

    // 3. Wait for the message overlay to appear.
    const overlay = page
      .locator('.msg-overlay-conversation-bubble, .msg-form__contenteditable')
      .first()
    const overlayOk = await overlay.waitFor({ timeout: 8_000 }).then(
      () => true,
      () => false
    )
    if (!overlayOk) return { success: false, error: 'overlay_failed' }

    // 4. Locate the contenteditable input and focus it.
    const input = page
      .locator('.msg-form__contenteditable[contenteditable="true"]')
      .first()
    await input.waitFor({ timeout: 5_000 })
    await page.waitForTimeout(_internal.jitter(350, 750))
    await input.click()

    // 5. Type the message — line-by-line, Shift+Enter for newlines,
    //    human-ish per-character cadence.
    const lines = text.split('\n')
    for (let i = 0; i < lines.length; i++) {
      await page.keyboard.type(lines[i], { delay: _internal.jitter(25, 65) })
      if (i < lines.length - 1) {
        await page.keyboard.down('Shift')
        await page.keyboard.press('Enter')
        await page.keyboard.up('Shift')
      }
    }

    await page.waitForTimeout(_internal.jitter(700, 1500))

    // 6. Make sure Send is enabled (proves the input was accepted).
    const sendBtn = page.locator('button.msg-form__send-button').first()
    const sendEnabled = await sendBtn
      .evaluate((el) => !el.disabled && !el.getAttribute('aria-disabled'))
      .catch(() => false)
    if (!sendEnabled) return { success: false, error: 'input_rejected' }

    if (dryRun) {
      return { success: true, dryRun: true, sentAt: Date.now() }
    }

    // 7. Fire the send.
    await page.waitForTimeout(_internal.jitter(600, 1400))
    await sendBtn.click()

    // 8. Verify — either the input clears, or the thread now shows
    //    our message as the latest outgoing item.
    await page.waitForTimeout(2_000)
    const afterText = await input.textContent().catch(() => '')
    const cleared = !afterText || afterText.trim().length === 0
    if (!cleared) return { success: false, error: 'send_verify_failed' }

    return { success: true, sentAt: Date.now() }
  } finally {
    await saveSessionIfValid(context).catch(() => {})
    await context.close().catch(() => {})
  }
}

// Re-export small helpers the API handler might want
export const _internal = { sleep, jitter }
