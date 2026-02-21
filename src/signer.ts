import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519"
import { getZkLoginSignature } from "@mysten/sui/zklogin"
import type { ZkLoginState } from "./types.js"

export interface Signer {
  getAddress(): string
  signTransaction(txBytes: string): Promise<string>
  signPersonalMessage(messageBytes: Uint8Array): Promise<{ bytes: string; signature: string }>
}

export class Ed25519Signer implements Signer {
  constructor(private readonly keypair: Ed25519Keypair) {}

  getAddress(): string {
    return this.keypair.getPublicKey().toSuiAddress()
  }

  async signTransaction(txBytes: string): Promise<string> {
    const { signature } = await this.keypair.signTransaction(
      Buffer.from(txBytes, "base64")
    )
    return signature
  }

  async signPersonalMessage(messageBytes: Uint8Array): Promise<{ bytes: string; signature: string }> {
    return this.keypair.signPersonalMessage(messageBytes)
  }
}

export class ZkLoginSigner implements Signer {
  constructor(
    private readonly ephemeralKeypair: Ed25519Keypair,
    private readonly state: ZkLoginState
  ) {}

  getAddress(): string {
    return this.state.walletAddress
  }

  async signTransaction(txBytes: string): Promise<string> {
    const { signature: userSignature } = await this.ephemeralKeypair.signTransaction(
      Buffer.from(txBytes, "base64")
    )

    return getZkLoginSignature({
      inputs: {
        ...this.state.zkProof,
        addressSeed: this.state.addressSeed,
      },
      maxEpoch: this.state.maxEpoch,
      userSignature,
    })
  }

  async signPersonalMessage(messageBytes: Uint8Array): Promise<{ bytes: string; signature: string }> {
    return this.ephemeralKeypair.signPersonalMessage(messageBytes)
  }
}
