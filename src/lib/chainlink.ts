import { createPublicClient, http, parseAbi } from 'viem'
import { mainnet } from 'viem/chains'

// Chainlink JPY/USD Price Feed on Ethereum Mainnet
const JPY_USD_FEED_ADDRESS = '0xBcE206caE7f0ec07b545EddE332A47C2F75bbeb3' as const

// Chainlink Aggregator V3 ABI (only latestRoundData)
const AGGREGATOR_V3_ABI = parseAbi([
  'function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)',
  'function decimals() external view returns (uint8)',
])

// Public client for Ethereum mainnet with shorter timeout
const mainnetClient = createPublicClient({
  chain: mainnet,
  transport: http('https://ethereum-rpc.publicnode.com', {
    timeout: 10_000, // 10 second timeout
  }),
})

export interface PriceData {
  jpyPerUsd: number
  usdPerJpy: number
  updatedAt: Date
  isCached?: boolean
}

// Simple in-memory cache
let priceCache: PriceData | null = null
let cacheTimestamp = 0
const CACHE_TTL = 60_000 // 1 minute cache

// Fallback price if API fails
const FALLBACK_JPY_PER_USD = 150

/**
 * Get JPY/USD price from Chainlink price feed on Ethereum mainnet
 * Returns JPY per 1 USD (e.g., 150.5 means 1 USD = 150.5 JPY)
 * Uses caching and fallback for reliability
 */
export async function getJpyUsdPrice(): Promise<PriceData> {
  // Check cache first
  const now = Date.now()
  if (priceCache && now - cacheTimestamp < CACHE_TTL) {
    return { ...priceCache, isCached: true }
  }

  try {
    const [latestRoundData, decimals] = await Promise.all([
      mainnetClient.readContract({
        address: JPY_USD_FEED_ADDRESS,
        abi: AGGREGATOR_V3_ABI,
        functionName: 'latestRoundData',
      }),
      mainnetClient.readContract({
        address: JPY_USD_FEED_ADDRESS,
        abi: AGGREGATOR_V3_ABI,
        functionName: 'decimals',
      }),
    ])

    const [, answer, , updatedAt] = latestRoundData

    // Chainlink JPY/USD returns USD per 1 JPY (e.g., 0.00667 means 1 JPY = $0.00667)
    const usdPerJpy = Number(answer) / Math.pow(10, decimals)
    // We need JPY per 1 USD (e.g., 150 means 1 USD = 150 JPY)
    const jpyPerUsd = 1 / usdPerJpy

    const priceData: PriceData = {
      jpyPerUsd,
      usdPerJpy,
      updatedAt: new Date(Number(updatedAt) * 1000),
    }

    // Update cache
    priceCache = priceData
    cacheTimestamp = now

    return priceData
  } catch (error) {
    console.error('Failed to fetch Chainlink price, using fallback:', error)

    // Return cached value if available, otherwise use fallback
    if (priceCache) {
      return { ...priceCache, isCached: true }
    }

    return {
      jpyPerUsd: FALLBACK_JPY_PER_USD,
      usdPerJpy: 1 / FALLBACK_JPY_PER_USD,
      updatedAt: new Date(),
      isCached: true,
    }
  }
}

/**
 * Convert USD amount to JPY using Chainlink price feed
 * @param usdAmount - Amount in USD (e.g., 0.50 for 50 cents)
 * @returns Amount in JPY
 */
export async function convertUsdToJpy(usdAmount: number): Promise<number> {
  const priceData = await getJpyUsdPrice()
  return usdAmount * priceData.jpyPerUsd
}

/**
 * Get JPYC amount for a given USD price
 * Returns the amount in JPYC (18 decimals) as bigint
 * @param usdPrice - Price in USD (e.g., 0.50 for 50 cents)
 */
export async function getJpycAmountForUsd(usdPrice: number): Promise<bigint> {
  const jpyAmount = await convertUsdToJpy(usdPrice)
  // JPYC has 18 decimals
  return BigInt(Math.floor(jpyAmount * 1e18))
}

/**
 * Get USDC amount for a given USD price
 * Returns the amount in USDC (6 decimals) as bigint
 * @param usdPrice - Price in USD (e.g., 0.50 for 50 cents)
 */
export function getUsdcAmountForUsd(usdPrice: number): bigint {
  // USDC has 6 decimals
  return BigInt(Math.floor(usdPrice * 1e6))
}
