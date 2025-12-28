import { NextRequest, NextResponse } from 'next/server'
import { createWalletClient, createPublicClient, http, type Hex, type Address } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { baseSepolia, sepolia } from 'viem/chains'
import { TRANSFER_WITH_AUTHORIZATION_ABI, parseSignature } from '@/lib/erc3009'
import { type TokenType, TOKEN_CONFIGS } from '@/lib/config'

// Facilitator's private key for paying gas
// In production, use a secure key management system
const FACILITATOR_PRIVATE_KEY = process.env.FACILITATOR_PRIVATE_KEY as Hex | undefined

interface ERC3009Request {
  from: Address
  to: Address
  value: string
  validAfter: string
  validBefore: string
  nonce: Hex
  signature: Hex
  token?: TokenType  // Optional: defaults to 'USDC' for backward compatibility
}

export async function POST(request: NextRequest) {
  try {
    if (!FACILITATOR_PRIVATE_KEY) {
      return NextResponse.json(
        { error: 'Facilitator not configured. Set FACILITATOR_PRIVATE_KEY in .env.local' },
        { status: 500 }
      )
    }

    const body: ERC3009Request = await request.json()
    const { from, to, value, validAfter, validBefore, nonce, signature, token = 'USDC' } = body

    // Validate required fields
    if (!from || !to || !value || !nonce || !signature) {
      return NextResponse.json(
        { error: 'Missing required fields: from, to, value, nonce, signature' },
        { status: 400 }
      )
    }

    // Get token configuration
    const tokenConfig = TOKEN_CONFIGS[token]
    if (!tokenConfig) {
      return NextResponse.json(
        { error: `Unsupported token: ${token}` },
        { status: 400 }
      )
    }

    // Parse signature
    const { v, r, s } = parseSignature(signature)

    // Create clients for the appropriate chain
    const facilitatorAccount = privateKeyToAccount(FACILITATOR_PRIVATE_KEY)

    const publicClient = createPublicClient({
      chain: tokenConfig.chain,
      transport: http(tokenConfig.rpcUrl),
    })

    const walletClient = createWalletClient({
      account: facilitatorAccount,
      chain: tokenConfig.chain,
      transport: http(tokenConfig.rpcUrl),
    })

    // Check if nonce has already been used
    const nonceUsed = await publicClient.readContract({
      address: tokenConfig.address,
      abi: TRANSFER_WITH_AUTHORIZATION_ABI,
      functionName: 'authorizationState',
      args: [from, nonce],
    })

    if (nonceUsed) {
      return NextResponse.json(
        { error: 'Authorization nonce has already been used' },
        { status: 400 }
      )
    }

    console.log(`Executing transferWithAuthorization (${token}):`, {
      token,
      chain: tokenConfig.chain.name,
      from,
      to,
      value,
      validAfter,
      validBefore,
      nonce,
      v,
      r: r.slice(0, 10) + '...',
      s: s.slice(0, 10) + '...',
    })

    // Execute transferWithAuthorization
    const txHash = await walletClient.writeContract({
      address: tokenConfig.address,
      abi: TRANSFER_WITH_AUTHORIZATION_ABI,
      functionName: 'transferWithAuthorization',
      args: [
        from,
        to,
        BigInt(value),
        BigInt(validAfter),
        BigInt(validBefore),
        nonce,
        v,
        r,
        s,
      ],
    })

    console.log('Transaction submitted:', txHash)

    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
      timeout: 60_000,
    })

    return NextResponse.json({
      success: true,
      transactionHash: txHash,
      blockNumber: receipt.blockNumber.toString(),
      status: receipt.status === 'success' ? 'confirmed' : 'failed',
    })

  } catch (error) {
    console.error('ERC-3009 Facilitator error:', error)
    return NextResponse.json(
      {
        error: 'Failed to execute transfer',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// GET endpoint to check facilitator status (fast response)
export async function GET() {
  try {
    if (!FACILITATOR_PRIVATE_KEY) {
      return NextResponse.json({
        configured: false,
        message: 'FACILITATOR_PRIVATE_KEY not set',
      })
    }

    const facilitatorAccount = privateKeyToAccount(FACILITATOR_PRIVATE_KEY)

    // Return immediately with configured status
    // Balance checks are expensive and slow, so we skip them for the status check
    return NextResponse.json({
      configured: true,
      address: facilitatorAccount.address,
      balanceEth: 'N/A',
      network: 'multi-chain',
    })
  } catch (error) {
    return NextResponse.json({
      configured: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
