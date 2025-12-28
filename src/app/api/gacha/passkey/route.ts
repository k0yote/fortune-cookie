import { NextRequest, NextResponse } from 'next/server'
import { type Hex, type Address } from 'viem'

// Pimlico API Key (server-side only)
const PIMLICO_API_KEY = process.env.PAYMASTER_PIMLICO_API_KEY || ''

// Gacha recipient address
const GACHA_RECIPIENT = (process.env.GACHA_RECIPIENT_ADDRESS || '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045') as Address

// Fortune Cookie API
const FORTUNE_API_URL = 'https://api.apiverve.com/v1/fortunecookie'
const FORTUNE_API_KEY = process.env.FORTUNE_API_KEY || ''

const FORTUNE_TYPES = ['大吉', '中吉', '小吉', '吉', '末吉', '凶']

const FALLBACK_FORTUNES = [
  { fortune: '大吉', message: 'Great luck awaits you today!' },
  { fortune: '中吉', message: 'Good things are coming your way.' },
  { fortune: '小吉', message: 'A peaceful day with small joys.' },
  { fortune: '吉', message: 'Steady progress leads to success.' },
  { fortune: '末吉', message: 'Better luck in the afternoon.' },
  { fortune: '凶', message: 'Be cautious today.' },
]

async function fetchFortune(): Promise<{ fortune: string; message: string }> {
  if (!FORTUNE_API_KEY) {
    return FALLBACK_FORTUNES[Math.floor(Math.random() * FALLBACK_FORTUNES.length)]
  }

  try {
    const res = await fetch(FORTUNE_API_URL, {
      headers: { 'X-API-Key': FORTUNE_API_KEY },
    })
    if (!res.ok) throw new Error(`API returned ${res.status}`)
    const data = await res.json()
    if (data.status === 'ok' && data.data?.fortune) {
      return {
        fortune: FORTUNE_TYPES[Math.floor(Math.random() * FORTUNE_TYPES.length)],
        message: data.data.fortune,
      }
    }
    throw new Error('Invalid API response')
  } catch {
    return FALLBACK_FORTUNES[Math.floor(Math.random() * FALLBACK_FORTUNES.length)]
  }
}

const PIMLICO_URL = `https://api.pimlico.io/v2/base-sepolia/rpc?apikey=${PIMLICO_API_KEY}`
const ENTRY_POINT_V07 = '0x0000000071727De22E5E9d8BAf0edAc6f37da032'

// Helper to make RPC calls to Pimlico
async function pimlicoRpc(method: string, params: unknown[]) {
  const response = await fetch(PIMLICO_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      params,
    }),
  })
  return response.json()
}

// POST: Submit signed UserOperation and get fortune
export async function POST(request: NextRequest) {
  try {
    if (!PIMLICO_API_KEY) {
      return NextResponse.json(
        { error: 'Paymaster not configured' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const { action } = body

    if (action === 'prepare') {
      // Step 1: Prepare UserOperation with gas estimates and paymaster
      const { userOp } = body

      if (!userOp || !userOp.sender || !userOp.callData) {
        return NextResponse.json(
          { error: 'Missing userOp fields' },
          { status: 400 }
        )
      }

      // Get current gas prices first
      const gasPriceResult = await pimlicoRpc('pimlico_getUserOperationGasPrice', [])
      if (gasPriceResult.error) {
        console.error('Gas price error:', gasPriceResult.error)
        return NextResponse.json(
          { error: 'Failed to get gas price' },
          { status: 500 }
        )
      }
      const gasPrice = gasPriceResult.result.fast

      // Get gas estimates (need to include maxFeePerGas for estimation)
      const gasResult = await pimlicoRpc('eth_estimateUserOperationGas', [
        {
          sender: userOp.sender,
          nonce: userOp.nonce,
          factory: userOp.factory || undefined,
          factoryData: userOp.factoryData || undefined,
          callData: userOp.callData,
          maxFeePerGas: gasPrice.maxFeePerGas,
          maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas,
          signature: userOp.signature, // Dummy signature for estimation
        },
        ENTRY_POINT_V07,
      ])

      if (gasResult.error) {
        console.error('Gas estimation error:', gasResult.error)
        return NextResponse.json(
          { error: gasResult.error.message || 'Gas estimation failed' },
          { status: 400 }
        )
      }

      const gasEstimates = gasResult.result

      // Get paymaster sponsorship
      const paymasterResult = await pimlicoRpc('pm_sponsorUserOperation', [
        {
          sender: userOp.sender,
          nonce: userOp.nonce,
          factory: userOp.factory || undefined,
          factoryData: userOp.factoryData || undefined,
          callData: userOp.callData,
          callGasLimit: gasEstimates.callGasLimit,
          verificationGasLimit: gasEstimates.verificationGasLimit,
          preVerificationGas: gasEstimates.preVerificationGas,
          maxFeePerGas: gasPrice.maxFeePerGas,
          maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas,
          signature: userOp.signature,
        },
        ENTRY_POINT_V07,
      ])

      if (paymasterResult.error) {
        console.error('Paymaster error:', paymasterResult.error)
        return NextResponse.json(
          { error: paymasterResult.error.message || 'Paymaster sponsorship failed' },
          { status: 400 }
        )
      }

      const paymaster = paymasterResult.result

      return NextResponse.json({
        success: true,
        preparedUserOp: {
          sender: userOp.sender,
          nonce: userOp.nonce,
          factory: userOp.factory || null,
          factoryData: userOp.factoryData || null,
          callData: userOp.callData,
          callGasLimit: paymaster.callGasLimit || gasEstimates.callGasLimit,
          verificationGasLimit: paymaster.verificationGasLimit || gasEstimates.verificationGasLimit,
          preVerificationGas: paymaster.preVerificationGas || gasEstimates.preVerificationGas,
          maxFeePerGas: gasPrice.maxFeePerGas,
          maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas,
          paymaster: paymaster.paymaster,
          paymasterVerificationGasLimit: paymaster.paymasterVerificationGasLimit,
          paymasterPostOpGasLimit: paymaster.paymasterPostOpGasLimit,
          paymasterData: paymaster.paymasterData,
        },
      })

    } else if (action === 'submit') {
      // Step 2: Submit signed UserOperation
      const { userOp } = body

      if (!userOp || !userOp.signature) {
        return NextResponse.json(
          { error: 'Missing signed userOp' },
          { status: 400 }
        )
      }

      // Submit to bundler
      const submitResult = await pimlicoRpc('eth_sendUserOperation', [
        {
          sender: userOp.sender,
          nonce: userOp.nonce,
          factory: userOp.factory || undefined,
          factoryData: userOp.factoryData || undefined,
          callData: userOp.callData,
          callGasLimit: userOp.callGasLimit,
          verificationGasLimit: userOp.verificationGasLimit,
          preVerificationGas: userOp.preVerificationGas,
          maxFeePerGas: userOp.maxFeePerGas,
          maxPriorityFeePerGas: userOp.maxPriorityFeePerGas,
          paymaster: userOp.paymaster,
          paymasterVerificationGasLimit: userOp.paymasterVerificationGasLimit,
          paymasterPostOpGasLimit: userOp.paymasterPostOpGasLimit,
          paymasterData: userOp.paymasterData,
          signature: userOp.signature,
        },
        ENTRY_POINT_V07,
      ])

      if (submitResult.error) {
        console.error('Submit error:', submitResult.error)
        return NextResponse.json(
          { error: submitResult.error.message || 'Failed to submit UserOperation' },
          { status: 400 }
        )
      }

      const userOpHash = submitResult.result as Hex

      // Wait for receipt
      let receipt = null
      for (let i = 0; i < 30; i++) {
        await new Promise(resolve => setTimeout(resolve, 2000))
        const receiptResult = await pimlicoRpc('eth_getUserOperationReceipt', [userOpHash])
        if (receiptResult.result) {
          receipt = receiptResult.result
          break
        }
      }

      if (!receipt) {
        return NextResponse.json(
          { error: 'UserOperation timeout - check transaction later' },
          { status: 500 }
        )
      }

      // Get fortune
      const fortune = await fetchFortune()

      return NextResponse.json({
        success: true,
        userOpHash,
        transactionHash: receipt.receipt?.transactionHash,
        fortune,
      })

    } else {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      )
    }

  } catch (error) {
    console.error('Passkey gacha error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// GET: Return payment info for passkey mode
export async function GET() {
  return NextResponse.json({
    recipient: GACHA_RECIPIENT,
    amount: '500000', // $0.50 in USDC (6 decimals)
    configured: !!PIMLICO_API_KEY,
  })
}
