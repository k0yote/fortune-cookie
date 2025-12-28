'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createAppKit } from '@reown/appkit/react'
import { baseSepolia, sepolia } from '@reown/appkit/networks'
import { WagmiProvider, type State } from 'wagmi'
import { wagmiAdapter, projectId, metadata } from '@/lib/wagmi'
import { useState, type ReactNode } from 'react'

// Create modal only on client side
if (typeof window !== 'undefined' && projectId) {
  createAppKit({
    adapters: [wagmiAdapter],
    projectId,
    networks: [baseSepolia, sepolia],
    defaultNetwork: baseSepolia,
    metadata,
    features: {
      analytics: false,
      email: false,
      socials: false,
    },
    themeMode: 'light',
  })
}

interface ReownProviderProps {
  children: ReactNode
  initialState?: State
}

export function ReownProvider({ children, initialState }: ReownProviderProps) {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig} initialState={initialState}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  )
}
