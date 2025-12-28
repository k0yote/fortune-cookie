'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  formatUnits,
  parseUnits,
  type Hex,
  encodeFunctionData,
  http,
} from 'viem'
import {
  createBundlerClient,
  createPaymasterClient,
} from 'viem/account-abstraction'
import {
  createPasskeyWallet,
  loadPasskeyWallet,
  clearStoredCredential,
  getStoredCredential,
} from '@/lib/passkey'
import { publicClient, USDC_ADDRESS, USDC_ABI, baseSepolia, PIMLICO_API_KEY } from '@/lib/config'

// 固定値
const FIXED_RECIPIENT = '0x096D076899FCd2572a3c0b977cbc4f8E2661C681'
const FIXED_AMOUNT = '0.001'

type WalletState = 'disconnected' | 'loading' | 'connected'

interface WalletData {
  address: Hex
  smartAccount: Awaited<ReturnType<typeof createPasskeyWallet>>['smartAccount']
}

export default function PasskeyWallet() {
  const [walletState, setWalletState] = useState<WalletState>('loading')
  const [wallet, setWallet] = useState<WalletData | null>(null)
  const [usdcBalance, setUsdcBalance] = useState<string>('0')
  const [ethBalance, setEthBalance] = useState<string>('0')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // 送金フォーム
  const [isSending, setIsSending] = useState(false)
  const [txHash, setTxHash] = useState<string | null>(null)

  // 初期化時に保存されたクレデンシャルをチェック
  useEffect(() => {
    const init = async () => {
      const stored = getStoredCredential()
      if (stored) {
        try {
          const walletData = await loadPasskeyWallet()
          if (walletData) {
            setWallet({
              address: walletData.address,
              smartAccount: walletData.smartAccount,
            })
            setWalletState('connected')
            return
          }
        } catch (err) {
          console.error('Failed to load wallet:', err)
          clearStoredCredential()
        }
      }
      setWalletState('disconnected')
    }
    init()
  }, [])

  // 残高を取得
  const fetchBalances = useCallback(async () => {
    if (!wallet) return

    try {
      const [usdc, eth] = await Promise.all([
        publicClient.readContract({
          address: USDC_ADDRESS,
          abi: USDC_ABI,
          functionName: 'balanceOf',
          args: [wallet.address],
        }),
        publicClient.getBalance({ address: wallet.address }),
      ])

      setUsdcBalance(formatUnits(usdc, 6))
      setEthBalance(formatUnits(eth, 18))
    } catch (err) {
      console.error('Failed to fetch balances:', err)
    }
  }, [wallet])

  useEffect(() => {
    if (wallet) {
      fetchBalances()
      const interval = setInterval(fetchBalances, 10000)
      return () => clearInterval(interval)
    }
  }, [wallet, fetchBalances])

  // Passkeyでウォレット作成
  const createWallet = async () => {
    setLoading(true)
    setError(null)

    try {
      const walletData = await createPasskeyWallet('Passkey Wallet')

      setWallet({
        address: walletData.address,
        smartAccount: walletData.smartAccount,
      })
      setWalletState('connected')
      setSuccess('ウォレットが作成されました！')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ウォレット作成に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  // ウォレット切断
  const disconnectWallet = () => {
    clearStoredCredential()
    setWallet(null)
    setWalletState('disconnected')
    setUsdcBalance('0')
    setEthBalance('0')
    setTxHash(null)
  }

  // Paymaster方式でUSDCを送金
  const sendUSDC = async () => {
    if (!wallet) return

    if (!PIMLICO_API_KEY) {
      setError('Pimlico API Keyが設定されていません。')
      return
    }

    setIsSending(true)
    setError(null)
    setTxHash(null)

    try {
      const pimlicoUrl = `https://api.pimlico.io/v2/base-sepolia/rpc?apikey=${PIMLICO_API_KEY}`

      const paymasterClient = createPaymasterClient({
        transport: http(pimlicoUrl),
      })

      const bundlerClient = createBundlerClient({
        client: publicClient,
        transport: http(pimlicoUrl),
        paymaster: paymasterClient,
      })

      const calldata = encodeFunctionData({
        abi: USDC_ABI,
        functionName: 'transfer',
        args: [FIXED_RECIPIENT as Hex, parseUnits(FIXED_AMOUNT, 6)],
      })

      setSuccess('Passkeyで署名中...')

      const userOpHash = await bundlerClient.sendUserOperation({
        account: wallet.smartAccount,
        calls: [{ to: USDC_ADDRESS, data: calldata }],
      })

      setSuccess(`UserOperation送信完了: ${userOpHash.slice(0, 10)}...`)

      const receipt = await bundlerClient.waitForUserOperationReceipt({
        hash: userOpHash,
      })

      setTxHash(receipt.receipt.transactionHash)
      setSuccess(`${FIXED_AMOUNT} USDC 送金完了！`)
      await fetchBalances()
    } catch (err) {
      console.error('Send failed:', err)
      setError(err instanceof Error ? err.message : '送金に失敗しました')
    } finally {
      setIsSending(false)
    }
  }

  if (walletState === 'loading') {
    return (
      <div className="w-full max-w-md mx-auto p-6 text-center">
        <p className="text-gray-600 dark:text-gray-400">読み込み中...</p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">Passkey Wallet</h1>
        <p className="text-gray-600 dark:text-gray-400 text-sm">
          Base Sepolia • USDC • Coinbase Smart Account
        </p>
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

      {walletState === 'disconnected' ? (
        <div className="space-y-4">
          <p className="text-center text-gray-600 dark:text-gray-400">
            Passkeyを使用してスマートウォレットを作成します
          </p>
          <button
            onClick={createWallet}
            disabled={loading}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition-colors"
          >
            {loading ? '作成中...' : 'Passkeyでウォレット作成'}
          </button>

          {!PIMLICO_API_KEY && (
            <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded-lg text-xs">
              <p className="font-semibold mb-1">設定が必要です</p>
              <p>.env.local に PAYMASTER_PIMLICO_API_KEY を設定してください。</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* ウォレット情報 */}
          <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg space-y-3">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Smart Account アドレス</p>
              <p className="font-mono text-sm break-all">{wallet?.address}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">USDC残高</p>
                <p className="text-lg font-semibold">{parseFloat(usdcBalance).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">ETH残高</p>
                <p className="text-lg font-semibold">{parseFloat(ethBalance).toFixed(4)}</p>
              </div>
            </div>
            <button
              onClick={fetchBalances}
              className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              残高を更新
            </button>
          </div>

          {/* 送金フォーム */}
          <div className="space-y-4">
            <h2 className="font-semibold">USDC送金（ガス代無料）</h2>
            <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">送金先</span>
                <span className="font-mono text-xs">{FIXED_RECIPIENT.slice(0, 10)}...{FIXED_RECIPIENT.slice(-8)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">金額</span>
                <span className="font-bold">{FIXED_AMOUNT} USDC</span>
              </div>
            </div>
            <button
              onClick={sendUSDC}
              disabled={isSending}
              className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
            >
              {isSending ? '処理中...' : 'Passkeyで署名して送金'}
            </button>
          </div>

          {/* トランザクション結果 */}
          {txHash && (
            <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">トランザクション</p>
              <a
                href={`https://sepolia.basescan.org/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 break-all"
              >
                {txHash}
              </a>
            </div>
          )}

          {/* 説明 */}
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-xs text-blue-700 dark:text-blue-300">
            <p className="font-semibold mb-1">ERC-4337 + Paymaster</p>
            <p>Pimlico Paymasterがガス代をスポンサー。ETH不要でUSDCを送金できます。</p>
          </div>

          {/* 切断ボタン */}
          <button
            onClick={disconnectWallet}
            className="w-full py-2 px-4 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            ウォレット切断
          </button>
        </div>
      )}

      {/* フッター情報 */}
      <div className="text-center text-xs text-gray-500 dark:text-gray-400 space-y-1">
        <p>Chain: Base Sepolia ({baseSepolia.id})</p>
        <p>USDC: {USDC_ADDRESS.slice(0, 10)}...{USDC_ADDRESS.slice(-8)}</p>
      </div>
    </div>
  )
}
