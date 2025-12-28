'use client'

import { useState } from 'react'
import PasskeyWallet from '@/components/PasskeyWallet'
import EOAWallet from '@/components/EOAWallet'

type WalletMode = 'passkey' | 'eoa'

export default function WalletPage() {
  const [mode, setMode] = useState<WalletMode>('passkey')

  return (
    <main className="min-h-screen bg-white dark:bg-gray-900 py-12">
      {/* Mode Switcher */}
      <div className="max-w-md mx-auto mb-6 px-6">
        <div className="flex rounded-lg bg-gray-100 dark:bg-gray-800 p-1">
          <button
            onClick={() => setMode('passkey')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              mode === 'passkey'
                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            Passkey (Smart Wallet)
          </button>
          <button
            onClick={() => setMode('eoa')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              mode === 'eoa'
                ? 'bg-white dark:bg-gray-700 text-orange-600 dark:text-orange-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            EOA (MetaMask)
          </button>
        </div>
        <p className="text-center text-xs text-gray-500 dark:text-gray-400 mt-2">
          {mode === 'passkey'
            ? 'Paymaster: ERC-4337でガス代無料'
            : 'Facilitator: ERC-3009でガス代無料'}
        </p>
      </div>

      {/* Wallet Component */}
      {mode === 'passkey' ? <PasskeyWallet /> : <EOAWallet />}

      {/* Gacha Link */}
      <div className="max-w-md mx-auto mt-8 px-6 text-center">
        <a
          href="/gacha"
          className="inline-block bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all hover:from-amber-600 hover:to-orange-600"
        >
          Fortune Gacha
        </a>
      </div>
    </main>
  )
}
