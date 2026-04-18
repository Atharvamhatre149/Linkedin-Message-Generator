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
// TODO (Phase 3)
export async function lookupCompany(/* name */) {
  throw new Error('not_implemented')
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
