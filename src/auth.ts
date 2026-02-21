import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519"
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client"
import {
  jwtToAddress,
  generateNonce,
  generateRandomness,
  genAddressSeed,
} from "@mysten/sui/zklogin"
import type { FortemClient } from "./client.js"
import { Ed25519Signer, ZkLoginSigner, type Signer } from "./signer.js"
import type { ZkProofResponse, NetworkConfig } from "./types.js"
import { getGoogleIdToken } from "./google-oauth.js"

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

interface SaltResponse {
  userSalt: string
  sub: string
  iss: string
  aud: string
  provider: string
  email?: string
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

export async function loginWithZkLogin(
  client: FortemClient,
  config: NetworkConfig
): Promise<{ accessToken: string; signer: Signer }> {
  // 1. Generate ephemeral keypair and nonce first (nonce must be embedded in the Google ID token)
  const suiClient = new SuiClient({ url: getFullnodeUrl(config.suiNetwork) })
  const { epoch } = await suiClient.getLatestSuiSystemState()
  const maxEpoch = Number(epoch) + 10

  const ephemeralKeypair = new Ed25519Keypair()
  const randomness = generateRandomness()
  const nonce = generateNonce(ephemeralKeypair.getPublicKey(), maxEpoch, randomness)

  // 2. Open browser and obtain a Google ID token with the nonce embedded
  const googleIdToken = await getGoogleIdToken(nonce)

  // 3. Fetch salt (used to derive wallet address)
  const saltData = await client.post<SaltResponse>("/api/v1/auth/salt", {
    jwt: googleIdToken,
  })
  const { userSalt, sub, aud } = saltData

  // 4. Derive wallet address
  const walletAddress = jwtToAddress(googleIdToken, userSalt)

  // 5. Call prover to generate ZK proof
  process.stderr.write(`[fortem-mcp] Calling ZK prover at ${config.proverUrl}...\n`)

  const proofRes = await fetch(`${config.proverUrl}/v1`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jwt: googleIdToken,
      salt: userSalt,
      extendedEphemeralPublicKey: ephemeralKeypair.getPublicKey().toBase64(),
      maxEpoch,
      jwtRandomness: randomness,
      keyClaimName: "sub",
    }),
  })

  if (!proofRes.ok) {
    throw new Error(`Prover returned ${proofRes.status}: ${await proofRes.text()}`)
  }

  const zkProof = (await proofRes.json()) as ZkProofResponse

  // addressSeed: genAddressSeed(salt, claimName, claimValue, aud) → BigInt string
  const addressSeed = genAddressSeed(BigInt(userSalt), "sub", sub, aud).toString()

  const signer = new ZkLoginSigner(ephemeralKeypair, {
    walletAddress,
    addressSeed,
    maxEpoch,
    zkProof,
  })

  process.stderr.write("[fortem-mcp] ZK Login: prover succeeded, transaction signing enabled\n")

  // 6. Login to Fortem (GOOGLE provider)
  const { accessToken } = await client.post<LoginResponse>("/api/v1/auth/login", {
    walletAddress,
    provider: "GOOGLE",
    providerAccountId: sub,
  })

  return { accessToken, signer }
}

export function createEd25519Signer(privateKey: string): { keypair: Ed25519Keypair; signer: Ed25519Signer } {
  const keypair = Ed25519Keypair.fromSecretKey(privateKey)
  return { keypair, signer: new Ed25519Signer(keypair) }
}
