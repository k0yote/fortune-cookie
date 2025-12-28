// QR Payment data format utilities
// Format: usdc:base-sepolia:0xADDRESS?amount=10.00

export interface QRPaymentData {
  address: string
  amount?: string
  chainId?: number
}

const CHAIN_NAMES: Record<number, string> = {
  84532: 'base-sepolia',
  8453: 'base',
}

const CHAIN_IDS: Record<string, number> = {
  'base-sepolia': 84532,
  'base': 8453,
}

export function encodeQRPayment(data: QRPaymentData): string {
  const chainName = CHAIN_NAMES[data.chainId || 84532] || 'base-sepolia'
  let qrData = `usdc:${chainName}:${data.address}`

  if (data.amount && parseFloat(data.amount) > 0) {
    qrData += `?amount=${data.amount}`
  }

  return qrData
}

export function decodeQRPayment(qrData: string): QRPaymentData | null {
  try {
    console.log('Decoding QR:', qrData)

    // Handle plain address
    if (qrData.startsWith('0x') && qrData.length === 42) {
      return { address: qrData }
    }

    // Handle EIP-681 ERC-20 transfer format
    // ethereum:TOKEN_ADDRESS@CHAIN_ID/transfer?address=RECIPIENT&uint256=AMOUNT
    if (qrData.startsWith('ethereum:') && qrData.includes('/transfer')) {
      const transferMatch = qrData.match(/ethereum:0x[a-fA-F0-9]{40}@(\d+)\/transfer\?(.+)/)
      if (transferMatch) {
        const chainId = parseInt(transferMatch[1])
        const params = new URLSearchParams(transferMatch[2])
        const recipient = params.get('address')
        const amountRaw = params.get('uint256')

        if (recipient) {
          // Convert from smallest unit (6 decimals for USDC) to human readable
          const amount = amountRaw ? (parseInt(amountRaw) / 1e6).toString() : undefined
          return {
            address: recipient,
            amount,
            chainId,
          }
        }
      }
    }

    // Handle simple ethereum: URI (EIP-681 style for ETH)
    if (qrData.startsWith('ethereum:')) {
      const match = qrData.match(/ethereum:(0x[a-fA-F0-9]{40})/)
      if (match) {
        const address = match[1]
        const amountMatch = qrData.match(/[?&]value=(\d+(?:\.\d+)?)/)
        return {
          address,
          amount: amountMatch ? amountMatch[1] : undefined,
        }
      }
    }

    // Handle our custom format: usdc:chain:address?amount=X
    if (qrData.startsWith('usdc:')) {
      const parts = qrData.replace('usdc:', '').split(':')
      if (parts.length >= 2) {
        const chainName = parts[0]
        const addressPart = parts[1]
        const [address, queryString] = addressPart.split('?')

        let amount: string | undefined
        if (queryString) {
          const params = new URLSearchParams(queryString)
          amount = params.get('amount') || undefined
        }

        return {
          address,
          amount,
          chainId: CHAIN_IDS[chainName],
        }
      }
    }

    return null
  } catch {
    return null
  }
}
