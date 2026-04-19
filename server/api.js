// ─────────────────────────────────────────────────────────────
//  server/api.js
//  Maps HTTP requests from Vite middleware → linkedin.js helpers.
//  Keeps vite.config.js thin and puts routing logic in one place.
// ─────────────────────────────────────────────────────────────

import * as linkedin from './linkedin.js'

async function readJson(req) {
  let body = ''
  for await (const chunk of req) body += chunk
  return body ? JSON.parse(body) : {}
}

function send(res, code, body) {
  res.statusCode = code
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

// ── Route table ──────────────────────────────────────────────
// Each entry: [method, pathSuffix, handler(req, res, body?)]
// pathSuffix is matched after `/api/` (already stripped by Vite).
const routes = [
  // ── AUTH ───────────────────────────────────────────────────
  [
    'GET',
    'auth/status',
    async (_req, res) => {
      const hasFile = linkedin.hasSession()
      if (!hasFile) return send(res, 200, { loggedIn: false, reason: 'no_session' })
      const probe = await linkedin.verifySession()
      return send(res, 200, { loggedIn: probe.valid, reason: probe.reason })
    },
  ],
  [
    'POST',
    'auth/login',
    async (_req, res) => {
      const result = await linkedin.login()
      return send(res, result.success ? 200 : 500, result)
    },
  ],
  [
    'POST',
    'auth/logout',
    async (_req, res) => {
      const ok = linkedin.clearSession()
      return send(res, 200, { success: ok })
    },
  ],

  // ── COMPANY ID LOOKUP (Phase 3) ────────────────────────────
  [
    'POST',
    'company/lookup',
    async (req, res) => {
      const { name } = await readJson(req)
      if (!name) return send(res, 400, { error: 'name_required' })
      try {
        const result = await linkedin.lookupCompany(name)
        if (!result) return send(res, 404, { error: 'not_found' })
        return send(res, 200, result)
      } catch (e) {
        if (e?.code === 'auth_expired') {
          return send(res, 401, { error: 'auth_expired' })
        }
        return send(res, 500, { error: 'lookup_failed', message: e?.message })
      }
    },
  ],

  // ── PEOPLE SEARCH (Phase 4) ────────────────────────────────
  [
    'POST',
    'search',
    async (req, res) => {
      const body = await readJson(req)
      try {
        const results = await linkedin.searchConnections(body)
        return send(res, 200, { results })
      } catch (e) {
        if (e?.code === 'auth_expired') {
          return send(res, 401, { error: 'auth_expired' })
        }
        return send(res, 500, { error: 'search_failed', message: e?.message })
      }
    },
  ],

  // ── MESSAGE SEND (Phase 5) ─────────────────────────────────
  // Single send. Used internally by the batch endpoint but also exposed
  // for one-off testing.
  [
    'POST',
    'send',
    async (req, res) => {
      const { profileUrl, message, dryRun = false } = await readJson(req)
      if (!profileUrl || !message) return send(res, 400, { error: 'missing_fields' })
      try {
        const result = await linkedin.sendMessage(profileUrl, message, { dryRun })
        return send(res, 200, result)
      } catch (e) {
        if (e?.code === 'auth_expired') {
          return send(res, 401, { error: 'auth_expired' })
        }
        return send(res, 500, { error: 'send_failed', message: e?.message })
      }
    },
  ],

  // Batch send — serially with jittered delay between targets.
  // Returns a streamed newline-delimited JSON (NDJSON) body so the UI can
  // show per-person progress without waiting for the whole batch.
  [
    'POST',
    'send/batch',
    async (req, res) => {
      const { targets, message, dryRun = false } = await readJson(req)
      if (!Array.isArray(targets) || !targets.length || !message) {
        return send(res, 400, { error: 'missing_fields' })
      }
      const MAX_PER_BATCH = 20
      if (targets.length > MAX_PER_BATCH) {
        return send(res, 400, { error: 'too_many', max: MAX_PER_BATCH })
      }

      res.statusCode = 200
      res.setHeader('Content-Type', 'application/x-ndjson')
      res.setHeader('Cache-Control', 'no-cache')
      const write = (obj) => res.write(JSON.stringify(obj) + '\n')

      const jitter = (min, max) => Math.floor(min + Math.random() * (max - min))
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

      try {
        for (let i = 0; i < targets.length; i++) {
          const t = targets[i]
          write({ type: 'progress', index: i, total: targets.length, profileUrl: t.profileUrl, name: t.name })
          let result
          try {
            result = await linkedin.sendMessage(t.profileUrl, message, { dryRun })
          } catch (e) {
            if (e?.code === 'auth_expired') {
              write({ type: 'result', index: i, success: false, error: 'auth_expired', profileUrl: t.profileUrl })
              write({ type: 'halt', reason: 'auth_expired' })
              break
            }
            result = { success: false, error: 'send_failed', message: e?.message }
          }
          write({ type: 'result', index: i, ...result, profileUrl: t.profileUrl, name: t.name })

          if (result.error === 'challenge_triggered') {
            write({ type: 'halt', reason: 'challenge_triggered' })
            break
          }

          if (i < targets.length - 1) {
            const delay = jitter(8_000, 20_000)
            write({ type: 'delay', ms: delay })
            await sleep(delay)
          }
        }
        write({ type: 'done' })
        res.end()
      } catch (e) {
        write({ type: 'error', message: e?.message })
        res.end()
      }
    },
  ],
]

export async function handleApi(req, res) {
  // Vite's server.middlewares.use('/api', fn) strips the /api prefix and
  // puts the remainder in req.url. Normalise.
  const pathSuffix = (req.url || '/').replace(/^\/+/, '').split('?')[0]
  const match = routes.find(
    ([m, p]) => m === req.method && p === pathSuffix
  )
  if (!match) return send(res, 404, { error: 'unknown_route', path: pathSuffix })
  try {
    await match[2](req, res)
  } catch (e) {
    return send(res, 500, { error: 'internal', message: e?.message })
  }
}

// Re-export shutdown so the vite plugin can close the shared browser on exit.
export const shutdown = linkedin.shutdown
