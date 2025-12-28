import { cookieStorage, createStorage } from 'wagmi'
import { baseSepolia, sepolia } from 'wagmi/chains'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'

// Get projectId from environment or use a placeholder
// NEXT_PUBLIC_ prefix is required for client-side access in Next.js
export const projectId = process.env.NEXT_PUBLIC_WALLET_REOWN_PROJECT_ID || ''

if (!projectId) {
  console.warn('NEXT_PUBLIC_WALLET_REOWN_PROJECT_ID is not set. WalletConnect will not work.')
}

// Metadata for the app
export const metadata = {
  name: 'Passkey Wallet',
  description: 'Gasless USDC/JPYC transfers with Passkey and ERC-3009',
  url: typeof window !== 'undefined' ? window.location.origin : 'https://localhost:3000',
  icons: ['https://avatars.githubusercontent.com/u/179229932'],
}

// Supported chains (Base Sepolia for USDC, Sepolia for JPYC)
export const chains = [baseSepolia, sepolia] as const

// Create wagmi adapter
export const wagmiAdapter = new WagmiAdapter({
  storage: createStorage({
    storage: cookieStorage,
  }),
  ssr: true,
  projectId,
  networks: [...chains],
})

export const wagmiConfig = wagmiAdapter.wagmiConfig
