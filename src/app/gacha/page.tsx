'use client'

import dynamic from 'next/dynamic'

// Dynamically import the gacha content to avoid SSR issues with useAppKit
const GachaContent = dynamic(() => import('@/components/GachaContent'), {
  ssr: false,
  loading: () => (
    <main className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-100 dark:from-gray-900 dark:to-gray-800 py-8">
      <div className="max-w-md mx-auto px-6 text-center">
        <h1 className="text-3xl font-bold text-amber-800 dark:text-amber-400 mb-2">
          Fortune Cookie
        </h1>
        <p className="text-amber-600 dark:text-amber-500">
          Loading...
        </p>
      </div>
    </main>
  ),
})

export default function GachaPage() {
  return <GachaContent />
}
