'use client'

import { useState, useEffect } from 'react'
import { useAccount, useSignTypedData, useSwitchChain, useReadContract } from 'wagmi'
import { type Address, formatUnits } from 'viem'
import { useAppKit } from '@reown/appkit/react'
import { ERC3009_TYPES, generateNonce, getTokenDomain } from '@/lib/erc3009'
import { type TokenType, TOKEN_CONFIGS, ERC20_ABI } from '@/lib/config'

interface PaymentInfo {
  version: string
  prices: {
    USDC: {
      amount: string
      decimals: number
      chainId: number
      address: string
      displayAmount: string
    }
    JPYC: {
      amount: string
      decimals: number
      chainId: number
      address: string
      displayAmount: string
      exchangeRate: string
    }
  }
  recipient: string
  description: string
}

interface Fortune {
  fortune: string
  message: string
}

type GachaState = 'idle' | 'loading' | 'spinning' | 'result'

// Ball colors for the gacha machine
const BALL_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#ec4899', '#f97316', '#06b6d4']

// Gacha Machine Component
function GachaMachine({ isSpinning, onHandleClick }: { isSpinning: boolean; onHandleClick?: () => void }) {
  return (
    <div className="gacha-machine">
      {/* Glass dome */}
      <div className="dome">
        <div className="dome-shine" />
        {/* Balls inside */}
        <div className="balls-container">
          {BALL_COLORS.map((color, i) => (
            <div
              key={i}
              className={`ball ${isSpinning ? 'bouncing' : ''}`}
              style={{
                backgroundColor: color,
                left: `${15 + (i % 4) * 20}%`,
                top: `${20 + Math.floor(i / 4) * 35}%`,
                animationDelay: `${i * 0.1}s`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Base */}
      <div className="base">
        <div className="base-top" />
        <div className="base-body">
          <div className="coin-slot">
            <div className="slot-line" />
          </div>
        </div>
        {/* Handle */}
        <div
          className={`handle-container ${isSpinning ? 'rotating' : ''}`}
          onClick={onHandleClick}
        >
          <div className="handle-arm" />
          <div className="handle-knob" />
        </div>
        {/* Dispenser */}
        <div className="dispenser">
          <div className="dispenser-flap" />
        </div>
      </div>

      <style jsx>{`
        .gacha-machine {
          position: relative;
          width: 200px;
          height: 320px;
          margin: 0 auto;
        }

        .dome {
          position: absolute;
          top: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 160px;
          height: 160px;
          background: linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(200,200,200,0.3) 50%, rgba(255,255,255,0.7) 100%);
          border-radius: 50%;
          border: 4px solid #d1d5db;
          overflow: hidden;
          box-shadow: inset 0 -20px 40px rgba(0,0,0,0.1), 0 4px 8px rgba(0,0,0,0.2);
        }

        .dome-shine {
          position: absolute;
          top: 10%;
          left: 15%;
          width: 30%;
          height: 20%;
          background: linear-gradient(135deg, rgba(255,255,255,0.8) 0%, transparent 100%);
          border-radius: 50%;
        }

        .balls-container {
          position: absolute;
          width: 100%;
          height: 100%;
        }

        .ball {
          position: absolute;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          box-shadow: inset -3px -3px 6px rgba(0,0,0,0.3), inset 3px 3px 6px rgba(255,255,255,0.3), 2px 2px 4px rgba(0,0,0,0.2);
          transition: transform 0.3s ease;
        }

        .ball.bouncing {
          animation: bounce 0.3s ease-in-out infinite alternate;
        }

        @keyframes bounce {
          0% { transform: translateY(0) rotate(0deg); }
          100% { transform: translateY(-8px) rotate(10deg); }
        }

        .base {
          position: absolute;
          bottom: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 140px;
          height: 170px;
        }

        .base-top {
          width: 100%;
          height: 20px;
          background: linear-gradient(to bottom, #e5e7eb, #d1d5db);
          border-radius: 4px 4px 0 0;
        }

        .base-body {
          width: 100%;
          height: 120px;
          background: linear-gradient(to right, #1f2937, #374151, #1f2937);
          border-radius: 0 0 8px 8px;
          position: relative;
        }

        .coin-slot {
          position: absolute;
          top: 20px;
          left: 50%;
          transform: translateX(-50%);
          width: 50px;
          height: 8px;
          background: #111827;
          border-radius: 4px;
          border: 2px solid #4b5563;
        }

        .slot-line {
          position: absolute;
          top: 50%;
          left: 10%;
          width: 80%;
          height: 2px;
          background: #374151;
          transform: translateY(-50%);
        }

        .handle-container {
          position: absolute;
          right: -35px;
          top: 40px;
          cursor: pointer;
          transform-origin: left center;
          transition: transform 0.1s ease;
        }

        .handle-container:hover {
          transform: rotate(-5deg);
        }

        .handle-container.rotating {
          animation: rotate-handle 0.5s ease-in-out infinite;
        }

        @keyframes rotate-handle {
          0% { transform: rotate(0deg); }
          50% { transform: rotate(180deg); }
          100% { transform: rotate(360deg); }
        }

        .handle-arm {
          width: 30px;
          height: 8px;
          background: linear-gradient(to bottom, #9ca3af, #6b7280);
          border-radius: 4px;
        }

        .handle-knob {
          position: absolute;
          right: -12px;
          top: -8px;
          width: 24px;
          height: 24px;
          background: linear-gradient(135deg, #dc2626, #b91c1c);
          border-radius: 50%;
          border: 2px solid #991b1b;
          box-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }

        .dispenser {
          position: absolute;
          bottom: 10px;
          left: 50%;
          transform: translateX(-50%);
          width: 50px;
          height: 30px;
          background: #111827;
          border-radius: 0 0 8px 8px;
          border: 2px solid #4b5563;
          border-top: none;
        }

        .dispenser-flap {
          position: absolute;
          bottom: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 40px;
          height: 4px;
          background: #374151;
          border-radius: 0 0 4px 4px;
        }
      `}</style>
    </div>
  )
}

// Result Popup with ball animation
function ResultPopup({
  fortune,
  txHash,
  token,
  onClose,
}: {
  fortune: Fortune
  txHash: string | null
  token: TokenType
  onClose: () => void
}) {
  const [showBall, setShowBall] = useState(true)
  const [showFortune, setShowFortune] = useState(false)

  useEffect(() => {
    // Ball drops, then opens to reveal fortune
    const timer = setTimeout(() => {
      setShowBall(false)
      setShowFortune(true)
    }, 1500)
    return () => clearTimeout(timer)
  }, [])

  const getFortuneColor = (fortuneType: string) => {
    switch (fortuneType) {
      case '大吉': return '#ef4444'
      case '中吉': return '#f97316'
      case '小吉': return '#eab308'
      case '吉': return '#22c55e'
      case '末吉': return '#3b82f6'
      case '凶': return '#6b7280'
      default: return '#6b7280'
    }
  }

  const ballColor = getFortuneColor(fortune.fortune)

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div className="popup-content" onClick={(e) => e.stopPropagation()}>
        {showBall && (
          <div className="ball-drop" style={{ backgroundColor: ballColor }}>
            <div className="ball-shine" />
          </div>
        )}

        {showFortune && (
          <div className="fortune-reveal">
            <div className="fortune-ball-open" style={{ borderColor: ballColor }}>
              <div className="fortune-text" style={{ color: ballColor }}>
                {fortune.fortune}
              </div>
            </div>
            <p className="fortune-message">{fortune.message}</p>
            {txHash && (
              <a
                href={`${token === 'USDC' ? 'https://sepolia.basescan.org' : 'https://sepolia.etherscan.io'}/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="tx-link"
              >
                View Transaction
              </a>
            )}
            <button onClick={onClose} className="close-btn">
              Close
            </button>
          </div>
        )}
      </div>

      <style jsx>{`
        .popup-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          animation: fadeIn 0.3s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .popup-content {
          background: white;
          border-radius: 20px;
          padding: 40px;
          min-width: 300px;
          min-height: 300px;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }

        .ball-drop {
          width: 100px;
          height: 100px;
          border-radius: 50%;
          position: relative;
          animation: dropBounce 1s ease-out, crack 0.3s ease-in 1.2s forwards;
          box-shadow: inset -10px -10px 20px rgba(0,0,0,0.3), inset 10px 10px 20px rgba(255,255,255,0.3), 0 10px 30px rgba(0,0,0,0.3);
        }

        .ball-shine {
          position: absolute;
          top: 15%;
          left: 20%;
          width: 30%;
          height: 25%;
          background: linear-gradient(135deg, rgba(255,255,255,0.8) 0%, transparent 100%);
          border-radius: 50%;
        }

        @keyframes dropBounce {
          0% { transform: translateY(-200px) scale(0.5); opacity: 0; }
          50% { transform: translateY(20px) scale(1.1); opacity: 1; }
          70% { transform: translateY(-10px) scale(0.95); }
          100% { transform: translateY(0) scale(1); }
        }

        @keyframes crack {
          0% { transform: scale(1); }
          50% { transform: scale(1.2); }
          100% { transform: scale(0); opacity: 0; }
        }

        .fortune-reveal {
          text-align: center;
          animation: revealFortune 0.5s ease-out;
        }

        @keyframes revealFortune {
          from { transform: scale(0); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }

        .fortune-ball-open {
          width: 120px;
          height: 120px;
          border-radius: 50%;
          border: 4px solid;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 20px;
          background: white;
          box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        }

        .fortune-text {
          font-size: 36px;
          font-weight: bold;
        }

        .fortune-message {
          font-size: 16px;
          color: #374151;
          margin-bottom: 20px;
          max-width: 250px;
        }

        .tx-link {
          display: block;
          color: #3b82f6;
          font-size: 14px;
          margin-bottom: 20px;
        }

        .tx-link:hover {
          text-decoration: underline;
        }

        .close-btn {
          background: linear-gradient(135deg, #f59e0b, #d97706);
          color: white;
          border: none;
          padding: 12px 32px;
          border-radius: 10px;
          font-weight: bold;
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .close-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4);
        }
      `}</style>
    </div>
  )
}

export default function GachaContent() {
  const { address, isConnected, chainId } = useAccount()
  const { signTypedDataAsync } = useSignTypedData()
  const { switchChainAsync } = useSwitchChain()
  const { open } = useAppKit()

  const [selectedToken, setSelectedToken] = useState<TokenType>('USDC')
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null)
  const [gachaState, setGachaState] = useState<GachaState>('idle')
  const [fortune, setFortune] = useState<Fortune | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)

  // Get token config for selected token
  const tokenConfig = TOKEN_CONFIGS[selectedToken]

  // Read USDC balance
  const { data: usdcBalance, refetch: refetchUsdc } = useReadContract({
    address: TOKEN_CONFIGS.USDC.address,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: TOKEN_CONFIGS.USDC.chainId,
    query: {
      enabled: !!address,
    },
  })

  // Read JPYC balance
  const { data: jpycBalance, refetch: refetchJpyc } = useReadContract({
    address: TOKEN_CONFIGS.JPYC.address,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: TOKEN_CONFIGS.JPYC.chainId,
    query: {
      enabled: !!address,
    },
  })

  // Get current balance based on selected token
  const currentBalance = selectedToken === 'USDC' ? usdcBalance : jpycBalance
  const formattedBalance = currentBalance
    ? formatUnits(currentBalance as bigint, tokenConfig.decimals)
    : '0'

  // Check if balance is sufficient
  const requiredAmount = paymentInfo?.prices[selectedToken]?.amount
  const hasInsufficientBalance = currentBalance !== undefined && requiredAmount
    ? (currentBalance as bigint) < BigInt(requiredAmount)
    : false

  useEffect(() => {
    fetchPaymentInfo()
  }, [])

  const fetchPaymentInfo = async () => {
    try {
      const res = await fetch('/api/gacha')
      const data = await res.json()
      if (data.paymentInfo) {
        setPaymentInfo(data.paymentInfo)
      }
    } catch (err) {
      console.error('Failed to fetch payment info:', err)
    }
  }

  const handleTokenChange = async (token: TokenType) => {
    setSelectedToken(token)
    const config = TOKEN_CONFIGS[token]

    if (isConnected && chainId !== config.chainId) {
      try {
        await switchChainAsync({ chainId: config.chainId })
      } catch (err) {
        console.error('Failed to switch chain:', err)
      }
    }
  }

  const handlePlay = async () => {
    if (!isConnected || !address || !paymentInfo) {
      return
    }

    setError(null)
    setGachaState('loading')

    try {
      const config = TOKEN_CONFIGS[selectedToken]
      const priceInfo = paymentInfo.prices[selectedToken]

      if (chainId !== config.chainId) {
        await switchChainAsync({ chainId: config.chainId })
      }

      const now = BigInt(Math.floor(Date.now() / 1000))
      const authorization = {
        from: address as Address,
        to: paymentInfo.recipient as Address,
        value: BigInt(priceInfo.amount),
        validAfter: 0n,
        validBefore: now + 3600n,
        nonce: generateNonce(),
      }

      setGachaState('spinning')

      const domain = getTokenDomain(selectedToken)
      const signature = await signTypedDataAsync({
        domain,
        types: ERC3009_TYPES,
        primaryType: 'TransferWithAuthorization',
        message: authorization,
      })

      const res = await fetch('/api/gacha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: authorization.from,
          to: authorization.to,
          value: authorization.value.toString(),
          validAfter: authorization.validAfter.toString(),
          validBefore: authorization.validBefore.toString(),
          nonce: authorization.nonce,
          signature,
          token: selectedToken,
        }),
      })

      const result = await res.json()

      if (!res.ok) {
        throw new Error(result.error || 'Payment failed')
      }

      setTxHash(result.transactionHash)
      setFortune(result.fortune)
      setGachaState('result')

      // Refetch balance after successful payment
      if (selectedToken === 'USDC') {
        refetchUsdc()
      } else {
        refetchJpyc()
      }

    } catch (err) {
      console.error('Gacha error:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
      setGachaState('idle')
    }
  }

  const handleReset = () => {
    setGachaState('idle')
    setFortune(null)
    setTxHash(null)
    setError(null)
    fetchPaymentInfo()
  }

  const getPrice = () => {
    if (!paymentInfo) return '...'
    const info = paymentInfo.prices[selectedToken]
    return `${info.displayAmount} ${selectedToken}`
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-100 dark:from-gray-900 dark:to-gray-800 py-8">
      <div className="max-w-md mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-amber-800 dark:text-amber-400 mb-2">
            Fortune Gacha
          </h1>
          <p className="text-amber-600 dark:text-amber-500">
            Turn the handle to reveal your fortune!
          </p>
        </div>

        {/* Token Selector */}
        <div className="flex justify-center gap-2 mb-4">
          <button
            onClick={() => handleTokenChange('USDC')}
            disabled={gachaState !== 'idle'}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              selectedToken === 'USDC'
                ? 'bg-blue-500 text-white shadow-lg'
                : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100'
            } ${gachaState !== 'idle' ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            USDC
          </button>
          <button
            onClick={() => handleTokenChange('JPYC')}
            disabled={gachaState !== 'idle'}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              selectedToken === 'JPYC'
                ? 'bg-green-500 text-white shadow-lg'
                : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100'
            } ${gachaState !== 'idle' ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            JPYC
          </button>
        </div>

        {/* Price Display */}
        <div className="text-center mb-6">
          <span className="inline-block bg-white dark:bg-gray-800 px-6 py-2 rounded-full shadow-md">
            <span className="text-gray-500 dark:text-gray-400 text-sm">1 Play: </span>
            <span className="text-xl font-bold text-amber-700 dark:text-amber-400">
              {getPrice()}
            </span>
          </span>
          {selectedToken === 'JPYC' && paymentInfo?.prices.JPYC.exchangeRate && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              ($0.50 USD @ {paymentInfo.prices.JPYC.exchangeRate} JPY/USD)
            </p>
          )}
        </div>

        {/* Gacha Machine */}
        <div className="flex justify-center mb-6">
          <GachaMachine isSpinning={gachaState === 'spinning' || gachaState === 'loading'} />
        </div>

        {/* Status Message */}
        <div className="text-center mb-4">
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            {gachaState === 'loading' && 'Preparing...'}
            {gachaState === 'spinning' && 'Processing payment...'}
            {gachaState === 'idle' && 'Press the button to play!'}
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 p-4 rounded-lg mb-4 text-center">
            {error}
          </div>
        )}

        {/* Action Button */}
        <div className="text-center">
          {!isConnected ? (
            <button
              onClick={() => open()}
              className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl shadow-lg transition-all hover:shadow-xl"
            >
              Connect Wallet
            </button>
          ) : (
            <button
              onClick={handlePlay}
              disabled={gachaState !== 'idle' || hasInsufficientBalance}
              className={`w-full py-4 font-bold rounded-xl shadow-lg transition-all ${
                gachaState !== 'idle' || hasInsufficientBalance
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white hover:shadow-xl'
              }`}
            >
              {gachaState === 'idle' ? (
                hasInsufficientBalance ? 'Insufficient Balance' : <>Play ({getPrice()})</>
              ) : (
                'Processing...'
              )}
            </button>
          )}
        </div>

        {/* Connected Wallet Info & Balance */}
        {isConnected && address && (
          <div className="mt-4 text-center">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {address.slice(0, 6)}...{address.slice(-4)}
            </div>
            <div className={`text-lg font-bold mt-1 ${hasInsufficientBalance ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>
              Balance: {Number(formattedBalance).toFixed(selectedToken === 'USDC' ? 2 : 0)} {selectedToken}
            </div>
            {hasInsufficientBalance && (
              <div className="text-xs text-red-500 mt-1">
                Insufficient balance
              </div>
            )}
          </div>
        )}

        {/* Wallet Link */}
        <div className="mt-6 text-center">
          <a
            href="/wallet"
            className="text-amber-600 dark:text-amber-400 hover:underline text-sm"
          >
            Go to Wallet (Send/Receive)
          </a>
        </div>
      </div>

      {/* Result Popup */}
      {gachaState === 'result' && fortune && (
        <ResultPopup
          fortune={fortune}
          txHash={txHash}
          token={selectedToken}
          onClose={handleReset}
        />
      )}
    </main>
  )
}
