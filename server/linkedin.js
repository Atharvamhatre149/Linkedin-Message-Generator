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

// ── Lifecycle ────────────────────────────────────────────────
let browserPromise = null

function getBrowser({ headless = true } = {}) {
  if (browserPromise) return browserPromise
  browserPromise = chromium.launch({
    headless,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-dev-shm-usage',
    ],
  })
  return browserPromise
}

async function newContext({ headless = true } = {}) {
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
 * Quick probe: open the feed using the saved session. If we land on /feed,
 * the session is still valid; otherwise it's expired or cleared.
 */
export async function verifySession() {
  if (!hasSession()) return { valid: false, reason: 'no_session' }

  // Cheap guard — if the file exists but is missing li_at, the login flow
  // never fully completed. Skip the network round-trip in that case.
  try {
    const raw = fs.readFileSync(SESSION_PATH, 'utf8')
    const parsed = JSON.parse(raw)
    const hasLiAt = (parsed.cookies || []).some(
      (c) => c.name === 'li_at' && c.value && c.value.length > 20
    )
    if (!hasLiAt) return { valid: false, reason: 'missing_li_at' }
  } catch {
    return { valid: false, reason: 'session_unreadable' }
  }

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
      reason: valid
        ? 'ok'
        : 'redirected_to_' + new URL(page.url()).pathname,
    }
  } catch (e) {
    return { valid: false, reason: e?.message || 'probe_failed' }
  } finally {
    await context.close().catch(() => {})
  }
}

// ── Company ID lookup ────────────────────────────────────────
// URN patterns that LinkedIn embeds on company pages / search results.
// Listed from most specific to least; first match wins.
const COMPANY_URN_PATTERNS = [
  /urn:li:fsd_company:(\d+)/,
  /urn:li:fs_company:(\d+)/,
  /urn:li:company:(\d+)/,
]

/**
 * Given a company name, return its numeric LinkedIn ID + display name.
 * Strategy:
 *   1. Open the authenticated people/company search for that keyword.
 *   2. Grab the first company result's link.
 *   3. If the URL already contains a numeric ID → done.
 *   4. Otherwise navigate to the company page and grep its HTML for a
 *      `urn:li:*_company:<id>` token (these are always present in the
 *      embedded JSON that LinkedIn ships for the client bundle).
 * Returns null when nothing matches.
 * Throws { code: 'auth_expired' } when the saved session is dead.
 */
export async function lookupCompany(name) {
  if (!name || !name.trim()) return null
  if (!hasSession()) {
    const err = new Error('auth_expired')
    err.code = 'auth_expired'
    throw err
  }

  const context = await newContext()
  const page = await context.newPage()

  try {
    // 1. Do a companies-scoped search.
    const searchUrl =
      'https://www.linkedin.com/search/results/companies/?keywords=' +
      encodeURIComponent(name.trim())

    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 20_000 })

    if (/\/(login|authwall|checkpoint)/.test(page.url())) {
      const err = new Error('auth_expired')
      err.code = 'auth_expired'
      throw err
    }

    // Give React / Voyager time to hydrate the result list. We can't rely on
    // a single stable selector because LinkedIn ships two or three layouts
    // concurrently (A/B testing). Waiting on the network to go idle is safer.
    await page
      .waitForLoadState('networkidle', { timeout: 8_000 })
      .catch(() => {})

    // 2. Pick the first company link. LinkedIn renders these as
    //    <a href="/company/{slug-or-id}/...">.
    const firstHref = await page.evaluate(() => {
      const candidates = document.querySelectorAll('a[href*="/company/"]')
      for (const a of candidates) {
        const href = a.getAttribute('href') || ''
        // Skip navigation links like /company/browse/... or /company/setup/.
        if (/\/company\/(browse|setup|signup|admin)/.test(href)) continue
        if (!/\/company\/[^/?#]+/.test(href)) continue
        return a.href
      }
      return null
    })

    if (!firstHref) return null

    // Try to harvest a display name from the first result card while we're here.
    const displayName = await page
      .evaluate((href) => {
        const a = document.querySelector(`a[href="${new URL(href).pathname}"]`)
        const card =
          a?.closest('.reusable-search__result-container, .entity-result, li') ||
          a?.parentElement
        const nameEl = card?.querySelector(
          '.entity-result__title-text a span[aria-hidden="true"], ' +
            '.entity-result__title-text, ' +
            'span[aria-hidden="true"]'
        )
        return nameEl?.textContent?.trim() || ''
      }, firstHref)
      .catch(() => '')

    // 3. Fast path — URL already has the numeric ID.
    const inlineId = firstHref.match(/\/company\/(\d+)(?:[/?#]|$)/)
    if (inlineId) {
      return { id: inlineId[1], name: displayName || name.trim(), url: firstHref }
    }

    // 4. Slow path — follow the slug URL and grep the HTML for a company URN.
    await page.goto(firstHref, { waitUntil: 'domcontentloaded', timeout: 20_000 })
    await page
      .waitForLoadState('networkidle', { timeout: 8_000 })
      .catch(() => {})

    if (/\/(login|authwall|checkpoint)/.test(page.url())) {
      const err = new Error('auth_expired')
      err.code = 'auth_expired'
      throw err
    }

    const html = await page.content()
    for (const pat of COMPANY_URN_PATTERNS) {
      const m = html.match(pat)
      if (m) {
        const title = (await page.title()).replace(/\s*\|\s*LinkedIn.*$/i, '').trim()
        return {
          id: m[1],
          name: displayName || title || name.trim(),
          url: page.url(),
        }
      }
    }

    return null
  } finally {
    // Refresh cookies + tidy up.
    await saveSession(context).catch(() => {})
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
    await saveSession(context).catch(() => {})
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
    await saveSession(context).catch(() => {})
    await context.close().catch(() => {})
  }
}

// Re-export small helpers the API handler might want
export const _internal = { sleep, jitter }
