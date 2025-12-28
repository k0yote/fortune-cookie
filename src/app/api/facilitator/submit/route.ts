import { NextRequest, NextResponse } from 'next/server'
import { Hex } from 'viem'

// Pimlico API (Facilitator owns this)
const PIMLICO_API_KEY = process.env.PAYMASTER_PIMLICO_API_KEY || ''
const BUNDLER_URL = `https://api.pimlico.io/v2/base-sepolia/rpc?apikey=${PIMLICO_API_KEY}`

// EntryPoint v0.6
const ENTRY_POINT_V06 = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789'

interface SubmitRequest {
  userOperation: {
    sender: Hex
    nonce: string
    initCode: Hex
    callData: Hex
    callGasLimit: string
    verificationGasLimit: string
    preVerificationGas: string
    maxFeePerGas: string
    maxPriorityFeePerGas: string
    paymasterAndData: Hex
    signature: Hex
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: SubmitRequest = await request.json()
    const { userOperation } = body

    if (!userOperation || !userOperation.signature) {
      return NextResponse.json(
        { error: 'Signed userOperation is required' },
        { status: 400 }
      )
    }

    if (!PIMLICO_API_KEY) {
      return NextResponse.json(
        { error: 'Facilitator not configured' },
        { status: 500 }
      )
    }

    // Format UserOp for bundler (convert to hex)
    const formattedUserOp = {
      sender: userOperation.sender,
      nonce: toHex(userOperation.nonce),
      initCode: userOperation.initCode || '0x',
      callData: userOperation.callData,
      callGasLimit: toHex(userOperation.callGasLimit),
      verificationGasLimit: toHex(userOperation.verificationGasLimit),
      preVerificationGas: toHex(userOperation.preVerificationGas),
      maxFeePerGas: toHex(userOperation.maxFeePerGas),
      maxPriorityFeePerGas: toHex(userOperation.maxPriorityFeePerGas),
      paymasterAndData: userOperation.paymasterAndData,
      signature: userOperation.signature,
    }

    console.log('Submitting UserOp to bundler:', JSON.stringify(formattedUserOp, null, 2))

    // Send to bundler
    const sendResponse = await fetch(BUNDLER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_sendUserOperation',
        params: [formattedUserOp, ENTRY_POINT_V06],
      }),
    })

    const sendResult = await sendResponse.json()

    if (sendResult.error) {
      console.error('Bundler error:', sendResult.error)
      return NextResponse.json(
        { error: 'Bundler rejected UserOperation', details: sendResult.error.message },
        { status: 400 }
      )
    }

    const userOpHash = sendResult.result
    console.log('UserOp submitted, hash:', userOpHash)

    // Wait for receipt (with timeout)
    let receipt = null
    for (let i = 0; i < 30; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000))

      const receiptResponse = await fetch(BUNDLER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_getUserOperationReceipt',
          params: [userOpHash],
        }),
      })

      const receiptResult = await receiptResponse.json()

      if (receiptResult.result) {
        receipt = receiptResult.result
        break
      }
    }

    if (!receipt) {
      return NextResponse.json({
        success: true,
        userOpHash,
        status: 'pending',
        message: 'UserOperation submitted, waiting for confirmation',
      })
    }

    return NextResponse.json({
      success: receipt.success,
      userOpHash,
      transactionHash: receipt.receipt?.transactionHash,
      blockNumber: receipt.receipt?.blockNumber,
      status: receipt.success ? 'confirmed' : 'failed',
    })

  } catch (error) {
    console.error('Submit error:', error)
    return NextResponse.json(
      {
        error: 'Failed to submit UserOperation',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Helper to convert values to hex
function toHex(value: string | number | bigint): Hex {
  if (typeof value === 'string') {
    if (value.startsWith('0x')) return value as Hex
    return `0x${BigInt(value).toString(16)}` as Hex
  }
  return `0x${BigInt(value).toString(16)}` as Hex
}
