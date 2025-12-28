import { NextRequest, NextResponse } from 'next/server'
import { encodeFunctionData, Hex, parseUnits } from 'viem'
import { USDC_ADDRESS, USDC_ABI } from '@/lib/config'

// Pimlico API (Facilitator owns this, not the client)
const PIMLICO_API_KEY = process.env.PAYMASTER_PIMLICO_API_KEY || ''
const BUNDLER_URL = `https://api.pimlico.io/v2/base-sepolia/rpc?apikey=${PIMLICO_API_KEY}`

// Public RPC for regular eth_call
const RPC_URL = 'https://sepolia.base.org'

// EntryPoint v0.6 (Coinbase Smart Wallet)
const ENTRY_POINT_V06 = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789'

interface PrepareRequest {
  sender: Hex           // Smart Wallet address
  to: Hex              // Recipient
  amount: string       // USDC amount (human readable, e.g., "1.5")
}

export async function POST(request: NextRequest) {
  try {
    const body: PrepareRequest = await request.json()
    const { sender, to, amount } = body

    if (!sender || !to || !amount) {
      return NextResponse.json(
        { error: 'sender, to, and amount are required' },
        { status: 400 }
      )
    }

    if (!PIMLICO_API_KEY) {
      return NextResponse.json(
        { error: 'Facilitator not configured' },
        { status: 500 }
      )
    }

    // Build call data for USDC transfer
    const callData = buildExecuteCallData(
      USDC_ADDRESS,
      0n,
      encodeFunctionData({
        abi: USDC_ABI,
        functionName: 'transfer',
        args: [to, parseUnits(amount, 6)],
      })
    )

    // Get nonce from EntryPoint
    const nonce = await getNonce(sender)

    // Get gas prices
    const gasPrices = await getGasPrices()

    // Use conservative gas estimates for Coinbase Smart Wallet
    // (Skip simulation which fails due to WebAuthn signature validation)
    const gasEstimates = {
      callGasLimit: 150000n,
      verificationGasLimit: 500000n,
      preVerificationGas: 80000n,
    }

    // Get Paymaster stub data (ERC-7677 - works without valid signature)
    const paymasterResult = await getPaymasterStubData(
      sender,
      nonce,
      callData,
      gasEstimates,
      gasPrices
    )

    // Build the UserOp for client to sign
    const userOpToSign = {
      sender,
      nonce: nonce.toString(),
      initCode: '0x',
      callData,
      callGasLimit: paymasterResult.callGasLimit?.toString() || gasEstimates.callGasLimit.toString(),
      verificationGasLimit: paymasterResult.verificationGasLimit?.toString() || gasEstimates.verificationGasLimit.toString(),
      preVerificationGas: paymasterResult.preVerificationGas?.toString() || gasEstimates.preVerificationGas.toString(),
      maxFeePerGas: gasPrices.maxFeePerGas.toString(),
      maxPriorityFeePerGas: gasPrices.maxPriorityFeePerGas.toString(),
      paymasterAndData: paymasterResult.paymasterAndData,
    }

    return NextResponse.json({
      success: true,
      userOperation: userOpToSign,
      transfer: {
        from: sender,
        to,
        amount,
        token: USDC_ADDRESS,
      },
    })

  } catch (error) {
    console.error('Prepare error:', error)
    return NextResponse.json(
      {
        error: 'Failed to prepare UserOperation',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Build execute call data for Coinbase Smart Wallet
function buildExecuteCallData(target: Hex, value: bigint, data: Hex): Hex {
  // Coinbase Smart Wallet uses execute(address target, uint256 value, bytes data)
  const executeAbi = [{
    name: 'execute',
    type: 'function',
    inputs: [
      { name: 'target', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'data', type: 'bytes' },
    ],
  }] as const

  return encodeFunctionData({
    abi: executeAbi,
    functionName: 'execute',
    args: [target, value, data],
  })
}

// Get nonce from EntryPoint
async function getNonce(sender: Hex): Promise<bigint> {
  const response = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_call',
      params: [{
        to: ENTRY_POINT_V06,
        data: encodeFunctionData({
          abi: [{
            name: 'getNonce',
            type: 'function',
            inputs: [
              { name: 'sender', type: 'address' },
              { name: 'key', type: 'uint192' },
            ],
            outputs: [{ type: 'uint256' }],
          }],
          functionName: 'getNonce',
          args: [sender, 0n],
        }),
      }, 'latest'],
    }),
  })

  const result = await response.json()
  if (result.error) {
    throw new Error(result.error.message)
  }

  return BigInt(result.result)
}

// Get gas prices from bundler
async function getGasPrices(): Promise<{ maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }> {
  const response = await fetch(BUNDLER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'pimlico_getUserOperationGasPrice',
      params: [],
    }),
  })

  const result = await response.json()
  if (result.error) {
    throw new Error(result.error.message)
  }

  return {
    maxFeePerGas: BigInt(result.result.fast.maxFeePerGas),
    maxPriorityFeePerGas: BigInt(result.result.fast.maxPriorityFeePerGas),
  }
}

// For Coinbase Smart Wallet with WebAuthn, we cannot get paymaster data without a valid signature
// Instead, return UserOp without paymaster - the submit endpoint will add paymaster after signing
async function getPaymasterStubData(
  _sender: Hex,
  _nonce: bigint,
  _callData: Hex,
  gasEstimates: { callGasLimit: bigint; verificationGasLimit: bigint; preVerificationGas: bigint },
  _gasPrices: { maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }
): Promise<{
  paymasterAndData: Hex
  callGasLimit?: bigint
  verificationGasLimit?: bigint
  preVerificationGas?: bigint
}> {
  // Return empty paymasterAndData - will be filled in submit step after client signs
  // This is a workaround for WebAuthn signature validation during simulation
  console.log('Prepare: Returning UserOp without paymaster (will be added in submit step)')

  return {
    paymasterAndData: '0x' as Hex,
    callGasLimit: gasEstimates.callGasLimit,
    verificationGasLimit: gasEstimates.verificationGasLimit,
    preVerificationGas: gasEstimates.preVerificationGas,
  }
}
