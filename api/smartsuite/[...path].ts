import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Vercel API Route: SmartSuite Proxy
 * Securely proxies requests to SmartSuite API
 *
 * Security Note: API key stored in Vercel environment variables only
 */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Get the path after /api/smartsuite/
  const { path: pathSegments } = req.query
  const smartSuitePath = Array.isArray(pathSegments) ? pathSegments.join('/') : pathSegments || ''

  // Build the SmartSuite API URL
  const smartSuiteUrl = `https://api.smartsuite.com/${smartSuitePath}`

  // Get SmartSuite credentials from environment
  const apiKey = process.env.VITE_SMARTSUITE_API_KEY
  const workspaceId = process.env.VITE_SMARTSUITE_WORKSPACE_ID || 's3qnmox1'

  if (!apiKey) {
    return res.status(500).json({
      error: 'SmartSuite API key not configured',
      details: 'VITE_SMARTSUITE_API_KEY environment variable is missing'
    })
  }

  try {
    // Prepare headers for SmartSuite API
    const headers: HeadersInit = {
      'Authorization': `Token ${apiKey}`,
      'ACCOUNT-ID': workspaceId,
      'Content-Type': 'application/json'
    }

    // Prepare fetch options
    const fetchOptions: RequestInit = {
      method: req.method,
      headers
    }

    // Add body for POST/PUT/PATCH requests
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      fetchOptions.body = JSON.stringify(req.body)
    }

    console.log(`[SmartSuite Proxy] ${req.method} ${smartSuiteUrl}`)

    // Make request to SmartSuite API
    const response = await fetch(smartSuiteUrl, fetchOptions)

    // Get response data
    const data = await response.json()

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
      return res.status(200).end()
    }

    // Return SmartSuite response
    if (response.ok) {
      return res.status(response.status).json(data)
    } else {
      console.error(`[SmartSuite Error] ${response.status}: ${response.statusText}`)
      return res.status(response.status).json({
        error: `SmartSuite API error: ${response.status} ${response.statusText}`,
        details: data
      })
    }

  } catch (error) {
    console.error('[SmartSuite Proxy Error]:', error)
    return res.status(500).json({
      error: 'Failed to proxy request to SmartSuite',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}