'use client'

import { QRCodeSVG } from 'qrcode.react'

// 固定値
const FIXED_RECIPIENT = '0x096D076899FCd2572a3c0b977cbc4f8E2661C681'
const FIXED_AMOUNT = '0.001'
const USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e'
const CHAIN_ID = 84532

interface QRReceiveProps {
  onClose: () => void
}

export default function QRReceive({ onClose }: QRReceiveProps) {
  // EIP-681 format for ERC-20 transfer
  // ethereum:TOKEN_ADDRESS@CHAIN_ID/transfer?address=RECIPIENT&uint256=AMOUNT
  const amountInWei = Math.floor(parseFloat(FIXED_AMOUNT) * 1e6) // USDC has 6 decimals
  const qrData = `ethereum:${USDC_ADDRESS}@${CHAIN_ID}/transfer?address=${FIXED_RECIPIENT}&uint256=${amountInWei}`

  console.log('QR Data:', qrData)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold">受取用QRコード</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-2xl"
          >
            ×
          </button>
        </div>

        <div className="flex justify-center p-4 bg-white rounded-xl">
          <QRCodeSVG
            value={qrData}
            size={200}
            level="M"
            includeMargin
          />
        </div>

        <div className="text-center space-y-2">
          <p className="text-sm text-gray-600 dark:text-gray-400">送金先</p>
          <p className="font-mono text-xs break-all">{FIXED_RECIPIENT}</p>
          <p className="text-2xl font-bold text-green-600">{FIXED_AMOUNT} USDC</p>
        </div>

        <p className="text-xs text-center text-gray-500 dark:text-gray-400">
          このQRをスキャンすると送金されます
        </p>
      </div>
    </div>
  )
}
