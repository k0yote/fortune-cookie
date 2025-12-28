# Fortune Cookie Gacha - ガスレス決済デモ

USDC（Base Sepolia）とJPYC（Sepolia）を使ったガスレス決済のサンプルアプリケーションです。

## 主な機能

### 🎰 Fortune Cookie Gacha（メイン）
- **ガチャマシン風UI**: CSSアニメーションでガチャマシンを再現
- **x402決済フロー**: HTTP 402 + ERC-3009による決済
- **Chainlink価格フィード**: JPY/USD為替レートをリアルタイム取得
- **Fortune Cookie API**: 外部APIからフォーチュンメッセージを取得
- **マルチトークン対応**: USDC ($0.50) / JPYC (約75円) で支払い可能

### 💳 ウォレット機能（/wallet）
- **Passkeyモード**: ERC-4337 + Paymaster でガスレス送金
- **EOAモード**: ERC-3009 + Facilitator でガスレス送金
- **QR決済**: スキャン払い対応

## デモフロー

```
┌─────────────────┐
│   / (ガチャ)    │  メインページ
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  ウォレット接続  │  WalletConnect
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ トークン選択    │  USDC / JPYC
│ (残高表示)      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Play ボタン    │  残高不足時は無効化
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  EIP-712署名    │  transferWithAuthorization
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Facilitator    │  ガス代負担で実行
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Fortune表示    │  ボールが落ちて結果表示
└─────────────────┘
```

## 対応トークン

| トークン | チェーン | Decimals | EIP-712 Domain |
|---------|---------|----------|----------------|
| USDC | Base Sepolia | 6 | name: "USDC", version: "2" |
| JPYC | Sepolia | 18 | name: "JPY Coin", version: "1" |

## 2つのモード

| モード | 対象ユーザー | 技術 | ガス負担 |
|--------|-------------|------|----------|
| **Passkey** | 新規ユーザー | ERC-4337 + Paymaster | Pimlico |
| **EOA** | 既存ウォレットユーザー | ERC-3009 + Facilitator | サーバー |

## 技術スタック

| 技術 | 用途 |
|------|------|
| [Next.js](https://nextjs.org/) 16 | フロントエンドフレームワーク |
| [viem](https://viem.sh/) | Ethereumライブラリ |
| [wagmi](https://wagmi.sh/) | React Hooks for Ethereum |
| [Reown AppKit](https://reown.com/) | WalletConnect対応 |
| [Pimlico](https://pimlico.io/) | Bundler & Paymaster |
| [Coinbase Smart Wallet](https://github.com/coinbase/smart-wallet) | ERC-4337 Smart Account |
| [Chainlink](https://chain.link/) | JPY/USD 価格フィード (Mainnet) |
| [Fortune Cookie API](https://apiverve.com/) | フォーチュンメッセージ取得 |

## 機能

### Passkeyモード（Smart Wallet）
- **Passkey認証**: Touch ID / Face ID / セキュリティキーでウォレット作成
- **Smart Account**: Coinbase Smart Wallet (ERC-4337)
- **Paymaster**: Pimlico Paymasterによるガスレス送金
- **対応トークン**: USDC (Base Sepolia)

### EOAモード（既存ウォレット）
- **WalletConnect対応**: MetaMask, Rainbow, Coinbase Wallet等
- **マルチチェーン**: USDC (Base Sepolia) / JPYC (Sepolia) 切り替え
- **ERC-3009**: `transferWithAuthorization`による署名ベース送金
- **Facilitator**: サーバーがガス代を負担
- **QR決済**: スキャン払い対応

## アーキテクチャ

### Passkeyモード（ERC-4337 + Paymaster）

```
┌─────────────────┐
│   Passkey       │  WebAuthn P256署名
│  (Touch ID等)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Coinbase Smart  │  ERC-4337 Smart Account
│    Account      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    Pimlico      │  Bundler + Paymaster
│   (Gasless)     │  ガス代スポンサー
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Base Sepolia   │
│     USDC        │
└─────────────────┘
```

### EOAモード（ERC-3009 + Facilitator）

```
┌─────────────────┐
│  MetaMask等     │  WalletConnect接続
│  (EOA Wallet)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  トークン選択   │  USDC / JPYC
│  チェーン切替   │  Base Sepolia / Sepolia
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   EIP-712       │  transferWithAuthorization
│   署名生成      │  (ERC-3009)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Facilitator    │  署名を受け取り
│   (Server)      │  ガス代を負担して実行
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  Base Sepolia        │    Sepolia   │
│  USDC                │    JPYC      │
└─────────────────────────────────────┘
```

## セットアップ

### 1. 依存関係のインストール

```bash
npm install --legacy-peer-deps
```

### 2. 環境変数の設定

`.env.local`ファイルを作成:

```env
# Pimlico (Passkeyモード用)
NEXT_PUBLIC_PIMLICO_API_KEY=pim_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Facilitator (EOAモード/ガチャ用) - ガス代を負担するウォレットの秘密鍵
# 注意: Base SepoliaとSepoliaの両方にETHが必要
FACILITATOR_PRIVATE_KEY=0x...

# Reown/WalletConnect
NEXT_PUBLIC_REOWN_PROJECT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Fortune Cookie API (ガチャ用)
FORTUNE_API_KEY=your_api_key_here

# ガチャ受取先アドレス (オプション)
GACHA_RECIPIENT_ADDRESS=0x...
```

**取得先:**
- [Pimlico Dashboard](https://dashboard.pimlico.io/) - Pimlico API Key
- [Reown Cloud](https://cloud.reown.com/) - Reown Project ID
- [APIVerve](https://apiverve.com/) - Fortune Cookie API Key

### 3. Facilitatorへの入金

EOAモードを使用する場合、Facilitatorウォレットに両チェーンのETHが必要です：

```bash
# Base Sepolia Faucet
https://www.coinbase.com/faucets/base-ethereum-goerli-faucet

# Sepolia Faucet
https://sepoliafaucet.com/
```

### 4. 開発サーバーの起動

```bash
npm run dev
```

http://localhost:3000 にアクセス

## 使い方

### Passkeyモード
1. 「Passkey (Smart Wallet)」を選択
2. 「Passkeyでウォレット作成」をクリック
3. デバイスのPasskey（Touch ID / Face ID等）で認証
4. 固定の送金先・金額で「Passkeyで署名して送金」

### EOAモード
1. 「EOA (MetaMask)」を選択
2. **トークン選択**: USDC / JPYC ボタンで切り替え
3. 「ウォレットを接続」をクリック
4. WalletConnectでMetaMask等を接続
5. チェーン切り替えを承認（自動で要求されます）
6. **直接送金**: 「送金する」ボタン
7. **QR決済**: 「スキャン払い」→ QRスキャン → 「支払う」

### QR決済フロー（店舗向け）

```
店舗側                        顧客側
───────                      ───────
QRコード表示        →        スマホでWebアプリ開く
（店舗の識別用）              ↓
                            WalletConnect接続
                              ↓
                            トークン選択（USDC/JPYC）
                              ↓
                            「スキャン払い」タップ
                              ↓
                            店舗QRをスキャン
                              ↓
                            「支払う」タップ
                              ↓
                            MetaMaskで署名
                              ↓
完了！              ←        Facilitatorが送金実行
```

## プロジェクト構成

```
├── src/
│   ├── app/
│   │   ├── page.tsx                    # /gacha へリダイレクト
│   │   ├── gacha/
│   │   │   └── page.tsx                # ガチャページ
│   │   ├── wallet/
│   │   │   └── page.tsx                # ウォレットページ (Passkey/EOA)
│   │   └── api/
│   │       ├── gacha/
│   │       │   └── route.ts            # ガチャAPI (x402決済)
│   │       └── facilitator/
│   │           └── erc3009/
│   │               └── route.ts        # ERC-3009 Facilitator API
│   ├── components/
│   │   ├── GachaContent.tsx            # ガチャUI + アニメーション
│   │   ├── PasskeyWallet.tsx           # Passkeyモード (USDC)
│   │   ├── EOAWallet.tsx               # EOAモード (USDC/JPYC)
│   │   ├── QRReceive.tsx               # QRコード表示
│   │   ├── QRScanner.tsx               # QRスキャナー
│   │   └── providers/
│   │       └── ReownProvider.tsx       # WalletConnect Provider
│   └── lib/
│       ├── config.ts                   # トークン・チェーン設定
│       ├── chainlink.ts                # Chainlink価格フィード
│       ├── passkey.ts                  # Passkey + Smart Account
│       ├── erc3009.ts                  # ERC-3009ユーティリティ
│       ├── wagmi.ts                    # wagmi設定
│       └── qrPayment.ts                # QR決済データ形式
```

## コントラクトアドレス

| トークン | アドレス | チェーン |
|---------|----------|----------|
| USDC | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` | Base Sepolia |
| JPYC | `0x431D5dfF03120AFA4bDf332c61A6e1766eF37BDB` | Sepolia |

## 技術的背景

### ERC-3009: Transfer With Authorization
USDCとJPYCが実装している規格。署名のみでトークン転送を承認でき、
Facilitatorがガス代を負担して`transferWithAuthorization()`を実行します。

```solidity
function transferWithAuthorization(
    address from,
    address to,
    uint256 value,
    uint256 validAfter,
    uint256 validBefore,
    bytes32 nonce,
    uint8 v, bytes32 r, bytes32 s
) external;
```

### EIP-712 ドメイン設定
トークンごとに異なるEIP-712ドメインを使用：

| トークン | name | version |
|---------|------|---------|
| USDC | "USDC" | "2" |
| JPYC | "JPY Coin" | "1" |

### Coinbase Smart Wallet + P256
Coinbase Smart WalletはP256（secp256r1）署名をネイティブにサポート。
Passkeyで署名したUserOperationを直接検証・実行できます。

### WalletConnect / Reown
モバイルウォレットとの接続を可能にするプロトコル。
ユーザーはブラウザ拡張なしでMetaMaskアプリ等を使用できます。

### Chainlink Price Feed
JPY/USD為替レートをEthereum Mainnetから取得。
JPYC支払い時の価格計算に使用します。

```
Feed Address: 0xBcE206caE7f0ec07b545EddE332A47C2F75bbeb3
Chain: Ethereum Mainnet
```

- 1分間キャッシュで高速化
- フォールバック価格: 150 JPY/USD

## 注意事項

- **HTTPS必須**: WebAuthn APIはlocalhost以外ではHTTPS環境が必要
- **ブラウザ対応**: Chrome, Safari, Firefox等のモダンブラウザが必要
- **Testnet**: Base SepoliaとSepoliaテストネット用のデモです
- **Facilitator残高**: EOAモードではFacilitatorウォレットに**両チェーン**のETHが必要

## 参考リンク

### Account Abstraction
- [viem Account Abstraction](https://viem.sh/account-abstraction)
- [Pimlico Documentation](https://docs.pimlico.io/)
- [Coinbase Smart Wallet](https://github.com/coinbase/smart-wallet)
- [ERC-4337](https://eips.ethereum.org/EIPS/eip-4337)

### ERC-3009 / Gasless Transfers
- [EIP-3009: Transfer With Authorization](https://eips.ethereum.org/EIPS/eip-3009)
- [Circle USDC](https://developers.circle.com/stablecoins/docs)
- [JPYC](https://jpyc.jp/)

### WalletConnect
- [Reown AppKit](https://reown.com/appkit)
- [wagmi Documentation](https://wagmi.sh/)

## ライセンス

MIT
