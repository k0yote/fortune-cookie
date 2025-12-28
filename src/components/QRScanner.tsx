'use client'

import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

interface QRScannerProps {
  onScan: () => void
  onClose: () => void
}

export default function QRScanner({ onScan, onClose }: QRScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const isRunningRef = useRef(false)
  const hasScannedRef = useRef(false)  // 一度スキャンしたらtrue
  const [error, setError] = useState<string | null>(null)
  const [isStarting, setIsStarting] = useState(true)

  useEffect(() => {
    const scannerId = 'qr-scanner-container'
    let mounted = true

    const startScanner = async () => {
      try {
        const scanner = new Html5Qrcode(scannerId)
        scannerRef.current = scanner

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          (decodedText) => {
            // Prevent multiple triggers
            if (hasScannedRef.current) {
              return
            }

            console.log('=== QR CODE DETECTED ===')
            console.log('Content:', decodedText)

            // Mark as scanned immediately to prevent duplicate calls
            hasScannedRef.current = true
            isRunningRef.current = false

            console.log('Stopping scanner and calling onScan...')
            scanner.stop().catch(() => {})
            onScan()
            console.log('onScan callback completed')
          },
          () => {
            // QR code not found - ignore
          }
        )

        if (mounted) {
          isRunningRef.current = true
          setIsStarting(false)
        }
      } catch (err) {
        console.error('Scanner error:', err)
        if (mounted) {
          setError('カメラにアクセスできません')
          setIsStarting(false)
        }
      }
    }

    startScanner()

    return () => {
      mounted = false
      if (scannerRef.current && isRunningRef.current) {
        isRunningRef.current = false
        scannerRef.current.stop().catch(() => {})
      }
    }
  }, [onScan])

  const handleClose = () => {
    if (scannerRef.current && isRunningRef.current) {
      isRunningRef.current = false
      scannerRef.current.stop().catch(() => {})
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-50">
      <div className="w-full max-w-sm p-4 space-y-4">
        <div className="flex justify-between items-center text-white">
          <h2 className="text-lg font-bold">QRコードをスキャン</h2>
          <button
            onClick={handleClose}
            className="text-white hover:text-gray-300 text-2xl"
          >
            ×
          </button>
        </div>

        <div className="relative bg-black rounded-xl overflow-hidden">
          <div id="qr-scanner-container" className="w-full" />

          {isStarting && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
              <p className="text-white">カメラを起動中...</p>
            </div>
          )}
        </div>

        {error && (
          <div className="p-3 bg-red-500/20 text-red-300 rounded-lg text-sm text-center">
            {error}
          </div>
        )}

        <p className="text-xs text-center text-gray-400">
          相手の受取用QRコードをカメラにかざしてください
        </p>
      </div>
    </div>
  )
}
