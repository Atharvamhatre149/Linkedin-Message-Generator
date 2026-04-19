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
    // Wait for either the feed (logged in) or a timeout
    await page.waitForURL(/linkedin\.com\/(feed|checkpoint|in\/)/, { timeout: timeoutMs })
    // Checkpoint (2FA/captcha) → keep waiting for feed
    if (/checkpoint/.test(page.url())) {
      await page.waitForURL(/linkedin\.com\/feed/, { timeout: timeoutMs })
    }
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
  const context = await newContext()
  const page = await context.newPage()
  try {
    await page.goto('https://www.linkedin.com/feed/', {
      waitUntil: 'domcontentloaded',
      timeout: 15_000,
    })
    const valid = /linkedin\.com\/feed/.test(page.url())
    return { valid, reason: valid ? 'ok' : 'redirected_to_' + new URL(page.url()).pathname }
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
// TODO (Phase 4)
export async function searchConnections(/* { companyId, filterKeywords, connectionsOnly } */) {
  throw new Error('not_implemented')
}

// ── Message sending ──────────────────────────────────────────
// TODO (Phase 5)
export async function sendMessage(/* profileUrl, text */) {
  throw new Error('not_implemented')
}

// Re-export small helpers the API handler might want
export const _internal = { sleep, jitter }
