import type { VercelRequest, VercelResponse } from '@vercel/node'

export default function handler(req: VercelRequest, res: VercelResponse) {
  console.log('[TEST API] Function called')

  res.status(200).json({
    message: 'API route is working!',
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url
  })
}