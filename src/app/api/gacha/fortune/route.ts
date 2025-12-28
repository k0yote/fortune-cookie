import { NextResponse } from 'next/server'

// Fortune Cookie API
const FORTUNE_API_URL = 'https://api.apiverve.com/v1/fortunecookie'
const FORTUNE_API_KEY = process.env.FORTUNE_API_KEY || ''

// Japanese fortune types based on fortune content
const FORTUNE_TYPES = ['大吉', '中吉', '小吉', '吉', '末吉', '凶']

// Fallback fortune messages
const FALLBACK_FORTUNES = [
  { fortune: '大吉', message: 'Great luck awaits you today!' },
  { fortune: '中吉', message: 'Good things are coming your way.' },
  { fortune: '小吉', message: 'A peaceful day with small joys.' },
  { fortune: '吉', message: 'Steady progress leads to success.' },
  { fortune: '末吉', message: 'Better luck in the afternoon.' },
  { fortune: '凶', message: 'Be cautious today.' },
]

// Fetch fortune from API
async function fetchFortune(): Promise<{ fortune: string; message: string }> {
  if (!FORTUNE_API_KEY) {
    console.warn('FORTUNE_API_KEY not set, using fallback')
    return FALLBACK_FORTUNES[Math.floor(Math.random() * FALLBACK_FORTUNES.length)]
  }

  try {
    const res = await fetch(FORTUNE_API_URL, {
      headers: {
        'X-API-Key': FORTUNE_API_KEY,
      },
    })

    if (!res.ok) {
      throw new Error(`API returned ${res.status}`)
    }

    const data = await res.json()

    if (data.status === 'ok' && data.data?.fortune) {
      // Assign a random Japanese fortune type
      const fortuneType = FORTUNE_TYPES[Math.floor(Math.random() * FORTUNE_TYPES.length)]
      return {
        fortune: fortuneType,
        message: data.data.fortune,
      }
    }

    throw new Error('Invalid API response')
  } catch (error) {
    console.error('Failed to fetch fortune from API:', error)
    return FALLBACK_FORTUNES[Math.floor(Math.random() * FALLBACK_FORTUNES.length)]
  }
}

// GET: Return a fortune (for Passkey mode after on-chain payment)
export async function GET() {
  const fortune = await fetchFortune()
  return NextResponse.json({ fortune })
}
