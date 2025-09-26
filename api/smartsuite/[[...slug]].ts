import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Dynamic SmartSuite Proxy using Vercel's catch-all route syntax
 * Route: /api/smartsuite/[[...slug]]
 * Handles all requests to /api/smartsuite/* and proxies them to SmartSuite
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  // Get the slug array (path segments after /api/smartsuite/)
  const { slug } = req.query
  const pathSegments = Array.isArray(slug) ? slug : slug ? [slug] : []
  const smartSuitePath = pathSegments.join('/')

  // Get API key
  const apiKey = process.env.VITE_SMARTSUITE_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'SmartSuite API key not configured' })
  }

  try {
    // Build the full SmartSuite URL
    const smartSuiteUrl = `https://app.smartsuite.com/${smartSuitePath}`

    console.log(`[SmartSuite Dynamic Proxy] ${req.method} ${smartSuiteUrl}`)

    const response = await fetch(smartSuiteUrl, {
      method: req.method || 'GET',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'ACCOUNT-ID': 's3qnmox1',
        'Content-Type': 'application/json'
      },
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined
    })

    const data = await response.json()
    console.log(`[SmartSuite Dynamic Proxy] Response: ${response.status}`)

    return res.status(response.status).json(data)
  } catch (error) {
    console.error('[SmartSuite Dynamic Proxy] Error:', error)
    return res.status(500).json({ error: 'Failed to proxy request' })
  }
}