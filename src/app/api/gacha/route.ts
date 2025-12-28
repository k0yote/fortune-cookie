import { NextRequest, NextResponse } from 'next/server'
import { createWalletClient, createPublicClient, http, type Hex, type Address } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { TRANSFER_WITH_AUTHORIZATION_ABI, parseSignature } from '@/lib/erc3009'
import { type TokenType, TOKEN_CONFIGS } from '@/lib/config'
import { getJpyUsdPrice } from '@/lib/chainlink'

// Gacha price in USD
const GACHA_PRICE_USD = 0.50

// Facilitator's private key for paying gas
const FACILITATOR_PRIVATE_KEY = process.env.FACILITATOR_PRIVATE_KEY as Hex | undefined

// Gacha recipient address (where payments go)
const GACHA_RECIPIENT = (process.env.GACHA_RECIPIENT_ADDRESS || '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045') as Address

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

interface PaymentRequest {
  from: Address
  to: Address
  value: string
  validAfter: string
  validBefore: string
  nonce: Hex
  signature: Hex
  token: TokenType
}

// x402 Payment Required response
async function createPaymentRequiredResponse() {
  // Get current JPY/USD price
  let jpyPrice: number
  let jpyPerUsd: number
  try {
    const priceData = await getJpyUsdPrice()
    jpyPerUsd = priceData.jpyPerUsd
    jpyPrice = GACHA_PRICE_USD * jpyPerUsd
  } catch (error) {
    console.error('Failed to fetch JPY/USD price:', error)
    // Fallback price
    jpyPerUsd = 150
    jpyPrice = GACHA_PRICE_USD * 150
  }

  // USDC amount (6 decimals)
  const usdcAmount = BigInt(Math.floor(GACHA_PRICE_USD * 1e6))
  // JPYC amount (18 decimals)
  const jpycAmount = BigInt(Math.floor(jpyPrice * 1e18))

  const paymentInfo = {
    version: '1',
    prices: {
      USDC: {
        amount: usdcAmount.toString(),
        decimals: 6,
        chainId: TOKEN_CONFIGS.USDC.chainId,
        address: TOKEN_CONFIGS.USDC.address,
        displayAmount: GACHA_PRICE_USD.toFixed(2),
      },
      JPYC: {
        amount: jpycAmount.toString(),
        decimals: 18,
        chainId: TOKEN_CONFIGS.JPYC.chainId,
        address: TOKEN_CONFIGS.JPYC.address,
        displayAmount: jpyPrice.toFixed(2),
        exchangeRate: jpyPerUsd.toFixed(2),
      },
    },
    recipient: GACHA_RECIPIENT,
    description: 'Fortune Cookie Gacha - 1 Play',
  }

  return NextResponse.json(
    {
      error: 'Payment Required',
      paymentInfo,
    },
    {
      status: 402,
      headers: {
        'X-Payment-Required': 'true',
        'X-Payment-Info': JSON.stringify(paymentInfo),
      },
    }
  )
}

// GET: Return payment requirements (402) or fortune if already paid
export async function GET() {
  // For GET requests, always return 402 to indicate payment is required
  return createPaymentRequiredResponse()
}

// POST: Process payment and return fortune
export async function POST(request: NextRequest) {
  try {
    if (!FACILITATOR_PRIVATE_KEY) {
      return NextResponse.json(
        { error: 'Facilitator not configured' },
        { status: 500 }
      )
    }

    const body: PaymentRequest = await request.json()
    const { from, to, value, validAfter, validBefore, nonce, signature, token } = body

    // Validate required fields
    if (!from || !to || !value || !nonce || !signature || !token) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Verify recipient matches our gacha recipient
    if (to.toLowerCase() !== GACHA_RECIPIENT.toLowerCase()) {
      return NextResponse.json(
        { error: 'Invalid recipient address' },
        { status: 400 }
      )
    }

    // Get token configuration
    const tokenConfig = TOKEN_CONFIGS[token]
    if (!tokenConfig) {
      return NextResponse.json(
        { error: `Unsupported token: ${token}` },
        { status: 400 }
      )
    }

    // Validate payment amount
    const paymentValue = BigInt(value)
    let expectedAmount: bigint

    if (token === 'USDC') {
      expectedAmount = BigInt(Math.floor(GACHA_PRICE_USD * 1e6))
    } else {
      // JPYC - get current rate
      try {
        const priceData = await getJpyUsdPrice()
        const jpyPrice = GACHA_PRICE_USD * priceData.jpyPerUsd
        expectedAmount = BigInt(Math.floor(jpyPrice * 1e18))
        // Allow 1% tolerance for price fluctuation
        const minAmount = expectedAmount * 99n / 100n
        if (paymentValue < minAmount) {
          return NextResponse.json(
            { error: 'Insufficient payment amount' },
            { status: 400 }
          )
        }
      } catch (error) {
        console.error('Failed to verify JPYC price:', error)
        // Use fallback rate
        expectedAmount = BigInt(Math.floor(GACHA_PRICE_USD * 150 * 1e18))
      }
    }

    if (token === 'USDC' && paymentValue < expectedAmount) {
      return NextResponse.json(
        { error: 'Insufficient payment amount' },
        { status: 400 }
      )
    }

    // Parse signature
    const { v, r, s } = parseSignature(signature)

    // Create clients
    const facilitatorAccount = privateKeyToAccount(FACILITATOR_PRIVATE_KEY)
    const publicClient = createPublicClient({
      chain: tokenConfig.chain,
      transport: http(tokenConfig.rpcUrl),
    })
    const walletClient = createWalletClient({
      account: facilitatorAccount,
      chain: tokenConfig.chain,
      transport: http(tokenConfig.rpcUrl),
    })

    // Check if nonce has already been used
    const nonceUsed = await publicClient.readContract({
      address: tokenConfig.address,
      abi: TRANSFER_WITH_AUTHORIZATION_ABI,
      functionName: 'authorizationState',
      args: [from, nonce],
    })

    if (nonceUsed) {
      return NextResponse.json(
        { error: 'Authorization nonce has already been used' },
        { status: 400 }
      )
    }

    console.log(`Processing gacha payment (${token}):`, {
      from,
      to,
      value,
      token,
    })

    // Execute transferWithAuthorization
    const txHash = await walletClient.writeContract({
      address: tokenConfig.address,
      abi: TRANSFER_WITH_AUTHORIZATION_ABI,
      functionName: 'transferWithAuthorization',
      args: [
        from,
        to,
        BigInt(value),
        BigInt(validAfter),
        BigInt(validBefore),
        nonce,
        v,
        r,
        s,
      ],
    })

    console.log('Gacha payment submitted:', txHash)

    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
      timeout: 60_000,
    })

    if (receipt.status !== 'success') {
      return NextResponse.json(
        { error: 'Payment transaction failed' },
        { status: 500 }
      )
    }

    // Payment successful - fetch fortune from API!
    const fortune = await fetchFortune()

    return NextResponse.json({
      success: true,
      transactionHash: txHash,
      fortune,
      paidWith: token,
      paidAmount: value,
    })

  } catch (error) {
    console.error('Gacha payment error:', error)
    return NextResponse.json(
      {
        error: 'Payment processing failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
