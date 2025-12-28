import { NextRequest, NextResponse } from 'next/server'
import { Hex } from 'viem'

// EntryPoint v0.6 address (used by Coinbase Smart Wallet v1)
const ENTRY_POINT_V06 = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Check network
    if (body.network !== 'base-sepolia') {
      return NextResponse.json(
        { error: 'Unsupported network. Only base-sepolia is supported.' },
        { status: 400 }
      )
    }

    const pimlicoApiKey = process.env.NEXT_PUBLIC_PIMLICO_API_KEY
    if (!pimlicoApiKey) {
      return NextResponse.json(
        { error: 'Bundler not configured' },
        { status: 500 }
      )
    }

    const bundlerUrl = `https://api.pimlico.io/v2/base-sepolia/rpc?apikey=${pimlicoApiKey}`

    // The payload should contain a pre-signed UserOperation
    if (!body.userOperation) {
      return NextResponse.json(
        { error: 'userOperation required in payload' },
        { status: 400 }
      )
    }

    const userOp = body.userOperation

    // Detect v0.6 vs v0.7 format
    const isV06 = 'initCode' in userOp || 'paymasterAndData' in userOp

    let formattedUserOp: Record<string, unknown>
    let entryPoint: string

    if (isV06) {
      // v0.6 format
      entryPoint = ENTRY_POINT_V06
      formattedUserOp = {
        sender: userOp.sender,
        nonce: toHex(userOp.nonce),
        initCode: userOp.initCode || '0x',
        callData: userOp.callData,
        callGasLimit: toHex(userOp.callGasLimit),
        verificationGasLimit: toHex(userOp.verificationGasLimit),
        preVerificationGas: toHex(userOp.preVerificationGas),
        maxFeePerGas: toHex(userOp.maxFeePerGas),
        maxPriorityFeePerGas: toHex(userOp.maxPriorityFeePerGas),
        paymasterAndData: userOp.paymasterAndData || '0x',
        signature: userOp.signature,
      }
    } else {
      // v0.7 format
      entryPoint = '0x0000000071727De22E5E9d8BAf0edAc6f37da032'
      formattedUserOp = {
        sender: userOp.sender,
        nonce: toHex(userOp.nonce),
        callData: userOp.callData,
        callGasLimit: toHex(userOp.callGasLimit),
        verificationGasLimit: toHex(userOp.verificationGasLimit),
        preVerificationGas: toHex(userOp.preVerificationGas),
        maxFeePerGas: toHex(userOp.maxFeePerGas),
        maxPriorityFeePerGas: toHex(userOp.maxPriorityFeePerGas),
        signature: userOp.signature,
        factory: userOp.factory || null,
        factoryData: userOp.factoryData || null,
        paymaster: userOp.paymaster || null,
        paymasterVerificationGasLimit: userOp.paymasterVerificationGasLimit ? toHex(userOp.paymasterVerificationGasLimit) : null,
        paymasterPostOpGasLimit: userOp.paymasterPostOpGasLimit ? toHex(userOp.paymasterPostOpGasLimit) : null,
        paymasterData: userOp.paymasterData || null,
      }
    }

    console.log('Using EntryPoint:', entryPoint)
    console.log('Formatted UserOp:', JSON.stringify(formattedUserOp, null, 2))

    // Send UserOperation via raw JSON-RPC
    const sendResponse = await fetch(bundlerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_sendUserOperation',
        params: [formattedUserOp, entryPoint],
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

    // Wait for receipt
    let receipt = null
    for (let i = 0; i < 30; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000))

      const receiptResponse = await fetch(bundlerUrl, {
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
        message: 'UserOperation submitted, waiting for confirmation',
      })
    }

    return NextResponse.json({
      success: true,
      userOpHash,
      transactionHash: receipt.receipt?.transactionHash,
      blockNumber: receipt.receipt?.blockNumber,
    })

  } catch (error) {
    console.error('Facilitator error:', error)
    return NextResponse.json(
      {
        error: 'Transaction failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Helper to convert values to hex
function toHex(value: string | number | bigint | undefined): Hex {
  if (value === undefined || value === null) return '0x0' as Hex
  if (typeof value === 'string') {
    if (value.startsWith('0x')) return value as Hex
    return `0x${BigInt(value).toString(16)}` as Hex
  }
  return `0x${BigInt(value).toString(16)}` as Hex
}

// GET endpoint to check facilitator status
export async function GET() {
  const pimlicoApiKey = process.env.NEXT_PUBLIC_PIMLICO_API_KEY

  if (!pimlicoApiKey) {
    return NextResponse.json({
      configured: false,
      message: 'Bundler API key not configured'
    })
  }

  return NextResponse.json({
    configured: true,
    network: 'base-sepolia',
  })
}
