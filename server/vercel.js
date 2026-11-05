import { groqMiddleware } from './groq.js';

// Vercel discovers /api entrypoints independently of Vite's static build.
export function createVercelHandler(path, config = {
  apiKey: process.env.GROQ_API_KEY,
  model: process.env.GROQ_MODEL,
}, fetchImpl = fetch) {
  const middleware = groqMiddleware(config, fetchImpl);
  return (req, res) => {
    req.url = path;
    return middleware(req, res, () => {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'API route not found.' }));
    });
  };
}
