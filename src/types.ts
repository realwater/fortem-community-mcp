export interface NetworkConfig {
  apiUrl: string
}

export function getNetworkConfig(network: string): NetworkConfig {
  if (network === "mainnet") {
    return { apiUrl: "https://api.fortem.gg" }
  }
  return { apiUrl: "https://testnet-api.fortem.gg" }
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
