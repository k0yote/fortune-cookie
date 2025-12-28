'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  formatUnits,
  parseUnits,
  type Address,
} from 'viem'
import { useAccount, useBalance, useSignTypedData, useDisconnect, useSwitchChain, useReadContract } from 'wagmi'
import { useAppKit } from '@reown/appkit/react'
import { baseSepolia, sepolia } from 'wagmi/chains'
import {
  ERC3009_TYPES,
  getTokenDomain,
  buildTransferAuthorization,
} from '@/lib/erc3009'
import { type TokenType, TOKEN_CONFIGS } from '@/lib/config'

import QRReceive from './QRReceive'
import QRScanner from './QRScanner'

// 固定値
const FIXED_RECIPIENT = '0x096D076899FCd2572a3c0b977cbc4f8E2661C681'
const FIXED_AMOUNTS: Record<TokenType, string> = {
  USDC: '0.001',
  JPYC: '1',  // 1 JPYC
}

export default function EOAWallet() {
  const { open } = useAppKit()
  const { address, isConnected, chainId } = useAccount()
  const { disconnect } = useDisconnect()
  const { switchChain } = useSwitchChain()
  const { signTypedDataAsync } = useSignTypedData()

  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Token selection
  const [selectedToken, setSelectedToken] = useState<TokenType>('USDC')
  const tokenConfig = TOKEN_CONFIGS[selectedToken]
  const fixedAmount = FIXED_AMOUNTS[selectedToken]

  // Transfer form
  const [isSending, setIsSending] = useState(false)
  const [txHash, setTxHash] = useState<string | null>(null)

  // QR modals
  const [showQRReceive, setShowQRReceive] = useState(false)
  const [showQRScanner, setShowQRScanner] = useState(false)
  const [qrScanned, setQrScanned] = useState(false)  // QRスキャン完了フラグ

  // Facilitator status
  const [facilitatorStatus, setFacilitatorStatus] = useState<{
    configured: boolean
    address?: string
    balanceEth?: string
    balances?: {
      baseSepolia: { balanceEth: string }
      sepolia: { balanceEth: string }
    }
  } | null>(null)

  // USDC Balance (Base Sepolia)
  const { data: usdcBalanceRaw, refetch: refetchUsdc } = useReadContract({
    address: TOKEN_CONFIGS.USDC.address,
    abi: [{
      name: 'balanceOf',
      type: 'function',
      stateMutability: 'view',
      inputs: [{ name: 'account', type: 'address' }],
      outputs: [{ name: '', type: 'uint256' }],
    }] as const,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: baseSepolia.id,
  })
  const usdcBalance = usdcBalanceRaw ? { value: usdcBalanceRaw as bigint, decimals: 6 } : null

  // JPYC Balance (Sepolia)
  const { data: jpycBalanceRaw, refetch: refetchJpyc } = useReadContract({
    address: TOKEN_CONFIGS.JPYC.address,
    abi: [{
      name: 'balanceOf',
      type: 'function',
      stateMutability: 'view',
      inputs: [{ name: 'account', type: 'address' }],
      outputs: [{ name: '', type: 'uint256' }],
    }] as const,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: sepolia.id,
  })
  const jpycBalance = jpycBalanceRaw ? { value: jpycBalanceRaw as bigint, decimals: 18 } : null

  const { data: ethBalance, refetch: refetchEth } = useBalance({
    address,
  })

  const fetchBalances = useCallback(() => {
    refetchUsdc()
    refetchJpyc()
    refetchEth()
  }, [refetchUsdc, refetchJpyc, refetchEth])

  // Check facilitator status
  useEffect(() => {
    const checkFacilitator = async () => {
      try {
        const response = await fetch('/api/facilitator/erc3009')
        const data = await response.json()
        setFacilitatorStatus(data)
      } catch (err) {
        console.error('Failed to check facilitator:', err)
      }
    }
    checkFacilitator()
  }, [])

  // Auto-switch to correct chain based on selected token
  const [hasSwitched, setHasSwitched] = useState(false)
  useEffect(() => {
    const targetChainId = tokenConfig.chainId
    if (isConnected && chainId && chainId !== targetChainId && !hasSwitched) {
      setHasSwitched(true)
      switchChain({ chainId: targetChainId })
    }
    // Reset when disconnected
    if (!isConnected) {
      setHasSwitched(false)
    }
  }, [isConnected, chainId, hasSwitched, switchChain, tokenConfig.chainId])

  // Switch chain when token changes
  const handleTokenChange = (token: TokenType) => {
    setSelectedToken(token)
    setTxHash(null)
    setError(null)
    setSuccess(null)
    setHasSwitched(false)  // Reset to allow auto-switch
    // Trigger chain switch
    const targetChainId = TOKEN_CONFIGS[token].chainId
    if (chainId !== targetChainId) {
      switchChain({ chainId: targetChainId })
    }
  }

  // Refresh balances periodically
  useEffect(() => {
    if (isConnected) {
      const interval = setInterval(fetchBalances, 10000)
      return () => clearInterval(interval)
    }
  }, [isConnected, fetchBalances])

  // Handle QR scan result - show confirmation, wait for user to press button
  const handleQRScan = () => {
    console.log('=== handleQRScan called ===')
    setShowQRScanner(false)
    setQrScanned(true)
    setSuccess('QRスキャン完了！下の「支払う」ボタンを押してください')
  }

  // Handle payment after QR scan confirmation
  const handleQRPayment = () => {
    console.log('=== handleQRPayment called ===')
    setQrScanned(false)
    setSuccess('MetaMaskアプリに戻って署名してください 📱')
    sendToken(FIXED_RECIPIENT, fixedAmount)
  }

  // Cancel QR payment
  const cancelQRPayment = () => {
    setQrScanned(false)
    setSuccess(null)
  }

  // Send token via ERC-3009
  const sendToken = async (recipient: string, amount: string) => {
    console.log('=== sendToken called ===')
    console.log('token:', selectedToken)
    console.log('recipient:', recipient)
    console.log('amount:', amount)
    console.log('address:', address)

    if (!address) {
      console.log('ERROR: No address connected')
      return
    }

    setIsSending(true)
    setError(null)
    setTxHash(null)

    try {
      // Step 1: Build authorization
      console.log('Step 1: Building authorization...')
      setSuccess('認可メッセージを構築中...')
      const value = parseUnits(amount, tokenConfig.decimals)
      console.log('value (in smallest unit):', value.toString())
      const authorization = buildTransferAuthorization({
        from: address,
        to: recipient as Address,
        value,
      })

      // Step 2: Sign with wallet (EIP-712)
      console.log('Step 2: Requesting signature...')
      console.log('authorization:', authorization)
      setSuccess('ウォレットで署名中...')
      const signature = await signTypedDataAsync({
        domain: getTokenDomain(selectedToken),
        types: ERC3009_TYPES,
        primaryType: 'TransferWithAuthorization',
        message: authorization,
      })
      console.log('Signature received:', signature)

      // Step 3: Send to Facilitator
      setSuccess('Facilitatorに送信中...')
      const response = await fetch('/api/facilitator/erc3009', {
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

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || result.details || 'Transfer failed')
      }

      setTxHash(result.transactionHash)
      setSuccess(`${amount} ${tokenConfig.symbol} 送金成功！`)
      fetchBalances()

    } catch (err) {
      console.error('Transfer failed:', err)
      setError(err instanceof Error ? err.message : 'Transfer failed')
      setSuccess(null)
    } finally {
      setIsSending(false)
    }
  }

  // Get explorer URL for transaction
  const getExplorerUrl = (hash: string) => {
    return selectedToken === 'JPYC'
      ? `https://sepolia.etherscan.io/tx/${hash}`
      : `https://sepolia.basescan.org/tx/${hash}`
  }

  // Check if on correct chain
  const isCorrectChain = chainId === tokenConfig.chainId

  return (
    <div className="w-full max-w-md mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">EOA Wallet (ERC-3009)</h1>
        <p className="text-gray-600 dark:text-gray-400 text-sm">
          {tokenConfig.chain.name} • {tokenConfig.symbol} • ガスレス送金
        </p>
      </div>

      {/* Token Selector */}
      <div className="flex gap-2">
        <button
          onClick={() => handleTokenChange('USDC')}
          className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
            selectedToken === 'USDC'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          USDC
          <span className="text-xs block opacity-75">Base Sepolia</span>
        </button>
        <button
          onClick={() => handleTokenChange('JPYC')}
          className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
            selectedToken === 'JPYC'
              ? 'bg-green-600 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          JPYC
          <span className="text-xs block opacity-75">Sepolia</span>
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="p-3 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg text-sm">
          {success}
        </div>
      )}

      {!isConnected ? (
        <div className="space-y-4">
          <p className="text-center text-gray-600 dark:text-gray-400">
            ウォレットを接続してガスレス送金を利用できます
          </p>
          <button
            onClick={() => open()}
            className="w-full py-3 px-4 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors"
          >
            ウォレットを接続
          </button>

          {facilitatorStatus && !facilitatorStatus.configured && (
            <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded-lg text-xs">
              <p className="font-semibold mb-1">Facilitator未設定</p>
              <p>.env.localにFACILITATOR_PRIVATE_KEYを設定してください。</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Wallet Info */}
          <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">アドレス</span>
              <button
                onClick={() => disconnect()}
                className="text-xs text-red-600 hover:text-red-700"
              >
                切断
              </button>
            </div>
            <p className="font-mono text-sm break-all">{address}</p>
            {!isCorrectChain && (
              <div className="mt-2 flex items-center gap-2">
                <p className="text-xs text-yellow-600">
                  {tokenConfig.chain.name}に切り替えが必要です
                </p>
                <button
                  onClick={() => switchChain({ chainId: tokenConfig.chainId })}
                  className="text-xs bg-yellow-500 hover:bg-yellow-600 text-white px-2 py-1 rounded"
                >
                  切り替え
                </button>
              </div>
            )}
          </div>

          {/* Balances */}
          <div className="grid grid-cols-2 gap-4">
            <div className={`p-4 rounded-lg ${selectedToken === 'USDC' ? 'bg-blue-100 dark:bg-blue-900/30 ring-2 ring-blue-500' : 'bg-blue-50 dark:bg-blue-900/20'}`}>
              <p className="text-sm text-gray-600 dark:text-gray-400">USDC</p>
              <p className="text-xl font-bold">
                {usdcBalance ? parseFloat(formatUnits(usdcBalance.value, 6)).toFixed(2) : '0.00'}
              </p>
              <p className="text-xs text-gray-500">Base Sepolia</p>
            </div>
            <div className={`p-4 rounded-lg ${selectedToken === 'JPYC' ? 'bg-green-100 dark:bg-green-900/30 ring-2 ring-green-500' : 'bg-green-50 dark:bg-green-900/20'}`}>
              <p className="text-sm text-gray-600 dark:text-gray-400">JPYC</p>
              <p className="text-xl font-bold">
                {jpycBalance ? parseFloat(formatUnits(jpycBalance.value, 18)).toFixed(2) : '0.00'}
              </p>
              <p className="text-xs text-gray-500">Sepolia</p>
            </div>
          </div>

          {/* QR Actions */}
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setShowQRReceive(true)}
              className="py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              <span className="text-xl">📲</span>
              受け取る
            </button>
            <button
              onClick={() => setShowQRScanner(true)}
              className="py-3 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              <span className="text-xl">📷</span>
              スキャン払い
            </button>
          </div>

          {/* Facilitator Info */}
          {facilitatorStatus?.configured && (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-xs">
              <p className="text-green-700 dark:text-green-300">
                Facilitator: {facilitatorStatus.address?.slice(0, 10)}... ({facilitatorStatus.balanceEth} ETH)
              </p>
            </div>
          )}

          {/* QR Scanned - Payment Confirmation */}
          {qrScanned && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="font-semibold text-purple-600">QRスキャン完了</h2>
                <button
                  onClick={cancelQRPayment}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  キャンセル
                </button>
              </div>
              <div className="p-4 bg-purple-100 dark:bg-purple-900/30 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">送金先</span>
                  <span className="font-mono text-xs">{FIXED_RECIPIENT.slice(0, 10)}...{FIXED_RECIPIENT.slice(-8)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">金額</span>
                  <span className="font-bold text-purple-600">{fixedAmount} {tokenConfig.symbol}</span>
                </div>
              </div>
              <button
                onClick={handleQRPayment}
                disabled={isSending || !facilitatorStatus?.configured || !isCorrectChain}
                className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
              >
                {isSending ? '処理中...' : '支払う（ガス代無料）'}
              </button>
              <p className="text-xs text-center text-gray-500">
                ボタンを押すとMetaMaskアプリに署名リクエストが届きます
              </p>
            </div>
          )}

          {/* Transfer Form - Fixed Data (hidden when QR scanned) */}
          {!qrScanned && (
            <div className="space-y-4">
              <h2 className="font-semibold">{tokenConfig.symbol}送金（ガスレス）</h2>
              <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">送金先</span>
                  <span className="font-mono text-xs">{FIXED_RECIPIENT.slice(0, 10)}...{FIXED_RECIPIENT.slice(-8)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">金額</span>
                  <span className="font-bold">{fixedAmount} {tokenConfig.symbol}</span>
                </div>
              </div>
              <button
                onClick={() => sendToken(FIXED_RECIPIENT, fixedAmount)}
                disabled={isSending || !facilitatorStatus?.configured || !isCorrectChain}
                className={`w-full py-3 px-4 ${selectedToken === 'JPYC' ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'} disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors`}
              >
                {isSending ? '送金中...' : '送金する（ガス代無料）'}
              </button>
            </div>
          )}

          {txHash && (
            <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Transaction Hash</p>
              <a
                href={getExplorerUrl(txHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-700 text-sm font-mono break-all"
              >
                {txHash}
              </a>
            </div>
          )}

          {/* 説明 */}
          <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg text-xs text-orange-700 dark:text-orange-300">
            <p className="font-semibold mb-1">ERC-3009 + Facilitator</p>
            <p>署名のみでガス代無料送金。WalletConnect対応で様々なウォレットが使えます。</p>
          </div>
        </div>
      )}

      {/* QR Modals */}
      {showQRReceive && (
        <QRReceive
          onClose={() => setShowQRReceive(false)}
        />
      )}

      {showQRScanner && (
        <QRScanner
          onScan={handleQRScan}
          onClose={() => setShowQRScanner(false)}
        />
      )}
    </div>
  )
}
