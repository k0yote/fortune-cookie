import { type Hex, type Address } from 'viem'
import { type TokenType, TOKEN_CONFIGS, USDC_ADDRESS, JPYC_ADDRESS } from './config'

// ERC-3009 TypedData for transferWithAuthorization
export const ERC3009_TYPES = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
} as const

// Re-export for backward compatibility
export { USDC_ADDRESS, JPYC_ADDRESS }

// Generate a random nonce for ERC-3009
export function generateNonce(): Hex {
  const randomBytes = new Uint8Array(32)
  crypto.getRandomValues(randomBytes)
  return `0x${Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('')}` as Hex
}

// Build ERC-3009 authorization message for signing
export function buildTransferAuthorization(params: {
  from: Address
  to: Address
  value: bigint
  validAfter?: bigint
  validBefore?: bigint
  nonce?: Hex
}) {
  const now = BigInt(Math.floor(Date.now() / 1000))

  return {
    from: params.from,
    to: params.to,
    value: params.value,
    validAfter: params.validAfter ?? 0n,
    validBefore: params.validBefore ?? now + 3600n, // 1 hour from now
    nonce: params.nonce ?? generateNonce(),
  }
}

// EIP-712 domain versions for each token
const TOKEN_DOMAIN_CONFIGS: Record<TokenType, { name: string; version: string }> = {
  USDC: { name: 'USDC', version: '2' },
  JPYC: { name: 'JPY Coin', version: '1' },
}

// Get token domain for EIP-712 signing
export function getTokenDomain(token: TokenType) {
  const config = TOKEN_CONFIGS[token]
  const domainConfig = TOKEN_DOMAIN_CONFIGS[token]
  return {
    name: domainConfig.name,
    version: domainConfig.version,
    chainId: config.chainId,
    verifyingContract: config.address,
  } as const
}

// Legacy function for backward compatibility
export function getUSDCDomain(chainId: number) {
  return {
    name: 'USDC',
    version: '2',
    chainId,
    verifyingContract: USDC_ADDRESS,
  } as const
}

// USDC ABI for transferWithAuthorization
export const TRANSFER_WITH_AUTHORIZATION_ABI = [
  {
    name: 'transferWithAuthorization',
    type: 'function',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'validAfter', type: 'uint256' },
      { name: 'validBefore', type: 'uint256' },
      { name: 'nonce', type: 'bytes32' },
      { name: 'v', type: 'uint8' },
      { name: 'r', type: 'bytes32' },
      { name: 's', type: 'bytes32' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'authorizationState',
    type: 'function',
    inputs: [
      { name: 'authorizer', type: 'address' },
      { name: 'nonce', type: 'bytes32' },
    ],
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
  },
] as const

// Parse signature into v, r, s components
export function parseSignature(signature: Hex): { v: number; r: Hex; s: Hex } {
  const sig = signature.slice(2) // remove 0x
  const r = `0x${sig.slice(0, 64)}` as Hex
  const s = `0x${sig.slice(64, 128)}` as Hex
  let v = parseInt(sig.slice(128, 130), 16)

  // Handle legacy v values
  if (v < 27) {
    v += 27
  }

  return { v, r, s }
}
