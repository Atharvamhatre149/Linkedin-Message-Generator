import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { handleApi, shutdown } from './server/api.js'

/**
 * Mounts our Playwright-backed API under /api/*.
 * All routes are defined in server/api.js; this plugin only handles
 * routing + lifecycle.
 */
function linkedinApiPlugin() {
  return {
    name: 'linkedin-api',
    configureServer(server) {
      server.middlewares.use('/api', (req, res, next) => {
        // Only intercept when the path starts with /api/<something>
        if (!req.url || req.url === '/' || req.url === '') return next()
        handleApi(req, res).catch((err) => {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'middleware_crash', message: String(err?.message || err) }))
        })
      })

      // Close Playwright cleanly on Ctrl-C / nodemon restart
      const cleanup = async () => {
        try {
          await shutdown()
        } catch {
          /* ignore */
        }
      }
      process.once('SIGINT', cleanup)
      process.once('SIGTERM', cleanup)
      process.once('beforeExit', cleanup)
    },
  }
}

export default defineConfig({
  plugins: [react(), linkedinApiPlugin()],
})
