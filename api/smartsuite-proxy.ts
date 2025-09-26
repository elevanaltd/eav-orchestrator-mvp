import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('[SmartSuite Proxy] Request received:', {
    method: req.method,
    url: req.url,
    body: req.body
  })

  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  // Get API configuration
  const apiKey = process.env.VITE_SMARTSUITE_API_KEY
  if (!apiKey) {
    console.error('[SmartSuite Proxy] No API key found')
    return res.status(500).json({ error: 'SmartSuite API key not configured' })
  }

  // For now, handle the specific projects endpoint
  if (req.method === 'POST' && req.url?.includes('smartsuite-proxy')) {
    try {
      const response = await fetch('https://app.smartsuite.com/api/v1/applications/68a8ff5237fde0bf797c05b3/records/list/', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${apiKey}`,
          'ACCOUNT-ID': 's3qnmox1',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(req.body || {})
      })

      const data = await response.json()
      console.log('[SmartSuite Proxy] Response:', response.status)

      return res.status(response.status).json(data)
    } catch (error) {
      console.error('[SmartSuite Proxy] Error:', error)
      return res.status(500).json({ error: 'Failed to proxy request' })
    }
  }

  return res.status(404).json({ error: 'Not found' })
}