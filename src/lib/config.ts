import { createPublicClient, http, parseAbi, type Address } from 'viem'
import { baseSepolia, sepolia } from 'viem/chains'
import { createPimlicoClient } from 'permissionless/clients/pimlico'
import { entryPoint07Address } from 'viem/account-abstraction'

// Token type definition
export type TokenType = 'USDC' | 'JPYC'

// Token configuration
export interface TokenConfig {
  address: Address
  symbol: string
  name: string
  decimals: number
  chainId: number
  chain: typeof baseSepolia | typeof sepolia
  rpcUrl: string
}

// Base Sepolia USDC (Circle's official testnet USDC)
export const USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as const

// Sepolia JPYC
export const JPYC_ADDRESS = '0x431D5dfF03120AFA4bDf332c61A6e1766eF37BDB' as const

// Token configurations
export const TOKEN_CONFIGS: Record<TokenType, TokenConfig> = {
  USDC: {
    address: USDC_ADDRESS,
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    chainId: baseSepolia.id,
    chain: baseSepolia,
    rpcUrl: 'https://base-sepolia-rpc.publicnode.com',
  },
  JPYC: {
    address: JPYC_ADDRESS,
    symbol: 'JPYC',
    name: 'JPY Coin',
    decimals: 18,
    chainId: sepolia.id,
    chain: sepolia,
    rpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com',
  },
}

export const ERC20_ABI = parseAbi([
  'function balanceOf(address account) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function approve(address spender, uint256 amount) returns (bool)',
])

// Legacy alias for backward compatibility
export const USDC_ABI = ERC20_ABI

// Public clients for each chain
export const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(),
})

export const sepoliaPublicClient = createPublicClient({
  chain: sepolia,
  transport: http('https://ethereum-sepolia-rpc.publicnode.com'),
})

// Get public client for a specific token
export function getPublicClientForToken(token: TokenType) {
  return token === 'JPYC' ? sepoliaPublicClient : publicClient
}

// Pimlico API Key - 環境変数から取得
export const PIMLICO_API_KEY = process.env.NEXT_PUBLIC_PIMLICO_API_KEY || ''

export const BUNDLER_URL = `https://api.pimlico.io/v2/base-sepolia/rpc?apikey=${PIMLICO_API_KEY}`

export const pimlicoClient = createPimlicoClient({
  transport: http(BUNDLER_URL),
  entryPoint: {
    address: entryPoint07Address,
    version: '0.7',
  },
})

export { baseSepolia, entryPoint07Address }
