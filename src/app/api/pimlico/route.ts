import { NextRequest, NextResponse } from 'next/server'

// Pimlico API Key (server-side only)
const PIMLICO_API_KEY = process.env.PAYMASTER_PIMLICO_API_KEY || ''
const PIMLICO_BASE_URL = 'https://api.pimlico.io/v2/base-sepolia/rpc'

// Simple proxy to Pimlico - forwards JSON-RPC requests
export async function POST(request: NextRequest) {
  if (!PIMLICO_API_KEY) {
    return NextResponse.json(
      { error: 'Pimlico API not configured' },
      { status: 500 }
    )
  }

  try {
    const body = await request.json()

    // Forward the request to Pimlico
    const response = await fetch(`${PIMLICO_BASE_URL}?apikey=${PIMLICO_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Pimlico proxy error:', error)
    return NextResponse.json(
      { error: 'Proxy request failed' },
      { status: 500 }
    )
  }
}

// GET: Check if configured
export async function GET() {
  return NextResponse.json({
    configured: !!PIMLICO_API_KEY,
    network: 'base-sepolia',
  })
}
