import { type Hex } from 'viem'
import {
  createWebAuthnCredential,
  toWebAuthnAccount,
  toCoinbaseSmartAccount,
  type WebAuthnAccount,
} from 'viem/account-abstraction'
import { publicClient } from './config'

export interface StoredCredential {
  id: string
  publicKey: Hex
}

// LocalStorageにクレデンシャルIDを保存するキー
const CREDENTIAL_STORAGE_KEY = 'passkey_credential_v2'

export async function createPasskeyWallet(name: string) {
  // WebAuthnクレデンシャルを作成
  const credential = await createWebAuthnCredential({
    name,
  })

  // クレデンシャルをLocalStorageに保存
  localStorage.setItem(CREDENTIAL_STORAGE_KEY, JSON.stringify({
    id: credential.id,
    publicKey: credential.publicKey,
  }))

  // WebAuthnAccountを作成
  const owner = toWebAuthnAccount({
    credential,
  })

  // Coinbase Smart Accountを作成
  const smartAccount = await toCoinbaseSmartAccount({
    client: publicClient,
    owners: [owner],
    version: '1',
  })

  return {
    credential: {
      id: credential.id,
      publicKey: credential.publicKey,
    },
    owner,
    smartAccount,
    address: smartAccount.address,
  }
}

export async function loadPasskeyWallet() {
  const stored = getStoredCredential()
  if (!stored) return null

  // 保存されたクレデンシャルからWebAuthnAccountを復元
  const credential = {
    id: stored.id,
    publicKey: stored.publicKey,
  }

  const owner = toWebAuthnAccount({
    credential,
  })

  // Coinbase Smart Accountを復元
  const smartAccount = await toCoinbaseSmartAccount({
    client: publicClient,
    owners: [owner],
    version: '1',
  })

  return {
    credential: stored,
    owner,
    smartAccount,
    address: smartAccount.address,
  }
}

export function getStoredCredential(): StoredCredential | null {
  if (typeof window === 'undefined') return null

  const stored = localStorage.getItem(CREDENTIAL_STORAGE_KEY)
  if (!stored) return null

  try {
    return JSON.parse(stored)
  } catch {
    return null
  }
}

export function clearStoredCredential(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(CREDENTIAL_STORAGE_KEY)
}

export type { WebAuthnAccount }
