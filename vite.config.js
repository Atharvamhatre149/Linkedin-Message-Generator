import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { groqMiddleware } from './server/groq.js'

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env }
  const config = { apiKey: env.GROQ_API_KEY, model: env.GROQ_MODEL }
  const middleware = () => groqMiddleware(config)
  return {
    plugins: [react(), {
      name: 'groq-api',
      configureServer(server) { server.middlewares.use(middleware()) },
      configurePreviewServer(server) { server.middlewares.use(middleware()) },
    }],
    server: { host: '127.0.0.1' },
    preview: { host: '127.0.0.1' },
  }
})
