export interface NetworkConfig {
  apiUrl: string
  proverUrl: string
  suiNetwork: "testnet" | "mainnet"
}

export function getNetworkConfig(network: string): NetworkConfig {
  if (network === "mainnet") {
    return {
      apiUrl: "https://api.fortem.gg",
      proverUrl: "https://prover.fortem.gg",
      suiNetwork: "mainnet",
    }
  }
  return {
    apiUrl: "https://testnet-api.fortem.gg",
    proverUrl: "https://dev-prover.fortem.gg",
    suiNetwork: "testnet",
  }
}

// Fortem API common response wrapper
export interface ApiResponse<T> {
  statusCode: number
  data: T
  metadata?: { pagination?: { totalItems: number } }
}

// prepare → execute pattern common response
export interface TxResponse {
  txId: string
  txBytes: string
  cost: string
  costTokenSymbol: string
  gasBudget: number
}

// ZK Login prover response
export interface ZkProofResponse {
  proofPoints: {
    a: string[]
    b: string[][]
    c: string[]
  }
  issBase64Details: {
    value: string
    indexMod4: number
  }
  headerBase64: string
}

// Stored ZK Login state for transaction signing
export interface ZkLoginState {
  walletAddress: string
  addressSeed: string
  maxEpoch: number
  zkProof: ZkProofResponse
}
