import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519"
import type { FortemClient } from "./client.js"
import { Ed25519Signer } from "./signer.js"

interface CheckWalletResponse {
  exists: boolean
  walletAddress: string
}

interface NonceResponse {
  nonce: string
}

interface LoginResponse {
  accessToken: string
  nickname: string
  profileImage: string
}

function buildLoginMessage(address: string, nonce: string, timestamp: number): string {
  return `{"message": "Sui Login for ${address}", "timestamp": ${timestamp}, "nonce": "${nonce}"}`
}

export async function loginWithEd25519(
  client: FortemClient,
  keypair: Ed25519Keypair
): Promise<string> {
  const address = keypair.getPublicKey().toSuiAddress()

  // 1. Check membership
  const { exists } = await client.post<CheckWalletResponse>("/api/v1/auth/check-wallet", {
    walletAddress: address,
  })
  if (!exists) {
    throw new Error(`Address ${address} is not a registered Fortem member. Please sign up at https://fortem.gg first.`)
  }

  // 2. Request nonce
  const { nonce } = await client.post<NonceResponse>("/api/v1/auth/nonce", {
    walletAddress: address,
  })

  // 3. Sign message
  const timestamp = Date.now()
  const message = buildLoginMessage(address, nonce, timestamp)
  const messageBytes = new TextEncoder().encode(message)
  const { bytes, signature } = await keypair.signPersonalMessage(messageBytes)

  // 4. Login
  const { accessToken } = await client.post<LoginResponse>("/api/v1/auth/login", {
    walletAddress: address,
    provider: "WALLET",
    signature,
    timestamp,
    nonce,
    bytes,
  })

  return accessToken
}

export function createEd25519Signer(privateKey: string): { keypair: Ed25519Keypair; signer: Ed25519Signer } {
  const keypair = Ed25519Keypair.fromSecretKey(privateKey)
  return { keypair, signer: new Ed25519Signer(keypair) }
}
