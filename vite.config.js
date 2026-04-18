import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// ── LinkedIn company-ID lookup ────────────────────────────────────────
// Strategy: LinkedIn's public company pages embed the numeric company ID
// in URNs like `urn:li:fsd_company:3015`. We try a handful of slug
// variations derived from the company name, fetch each page, and scrape
// the ID out of the HTML.

const SLUG_ID_PATTERNS = [
  /urn:li:fsd_company:(\d+)/,
  /urn:li:fs_company:(\d+)/,
  /urn:li:company:(\d+)/,
  /"companyId"\s*:\s*(\d+)/,
  /"companyId"\s*:\s*"(\d+)"/,
  /linkedin\.com\/company\/(\d+)/,
]

function candidateSlugs(name) {
  const clean = name.trim().toLowerCase()
  const noPunct = clean.replace(/[^a-z0-9\s-]/g, '')
  const variants = [
    noPunct.replace(/\s+/g, '-'),        // "meta platforms" → "meta-platforms"
    noPunct.replace(/\s+/g, ''),         // "meta platforms" → "metaplatforms"
    noPunct.replace(/\s+/g, '-') + '-inc',
    clean.replace(/\s+/g, '-'),          // keep punctuation
  ].map(s => s.replace(/^-+|-+$/g, '').replace(/-+/g, '-'))
  return [...new Set(variants.filter(Boolean))]
}

async function fetchWithTimeout(url, opts = {}, ms = 8000) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal })
  } finally {
    clearTimeout(t)
  }
}

async function lookupCompanyId(name) {
  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml',
    'Accept-Language': 'en-US,en;q=0.9',
  }

  for (const slug of candidateSlugs(name)) {
    const url = `https://www.linkedin.com/company/${slug}/`
    try {
      const resp = await fetchWithTimeout(url, { headers, redirect: 'follow' })
      if (!resp.ok) continue
      const html = await resp.text()
      for (const pat of SLUG_ID_PATTERNS) {
        const m = html.match(pat)
        if (m) return { id: m[1], slug, url: resp.url || url }
      }
    } catch {
      /* try next slug */
    }
  }
  return null
}

function companyLookupPlugin() {
  return {
    name: 'company-lookup',
    configureServer(server) {
      server.middlewares.use('/api/lookup-company', async (req, res) => {
        const send = (code, body) => {
          res.statusCode = code
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(body))
        }

        if (req.method !== 'POST') return send(405, { error: 'method_not_allowed' })

        try {
          let body = ''
          for await (const chunk of req) body += chunk
          const { name } = JSON.parse(body || '{}')
          if (!name || typeof name !== 'string') {
            return send(400, { error: 'name_required' })
          }
          const result = await lookupCompanyId(name)
          if (!result) return send(404, { error: 'not_found' })
          return send(200, result)
        } catch (e) {
          return send(500, { error: 'lookup_failed', message: String(e?.message || e) })
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), companyLookupPlugin()],
})
