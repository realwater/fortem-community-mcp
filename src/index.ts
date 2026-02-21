#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { FortemClient } from "./client.js"
import {
  loginWithEd25519,
  createEd25519Signer,
} from "./auth.js"
import { getNetworkConfig } from "./types.js"
import type { Signer } from "./signer.js"
import { registerCollectionTools } from "./tools/collection.js"
import { registerItemTools } from "./tools/item.js"
import { registerKioskTools } from "./tools/kiosk.js"
import { registerMarketTools } from "./tools/market.js"
import { registerDeveloperTools } from "./tools/developer.js"

async function main(): Promise<void> {
  // ── 1. Network configuration ─────────────────────
  const networkEnv = process.env.FORTEM_NETWORK ?? "testnet"
  if (networkEnv !== "testnet" && networkEnv !== "mainnet") {
    throw new Error(`FORTEM_NETWORK must be "testnet" or "mainnet", got: "${networkEnv}"`)
  }
  const config = getNetworkConfig(networkEnv)
  process.stderr.write(`[fortem-mcp] Network: ${networkEnv} (${config.apiUrl})\n`)

  // ── 2. Lazy auth state ────────────────────────────
  let _realSigner: Signer | null = null
  let _developerApiKey = ""
  let _authInitialized = false
  let _initPromise: Promise<void> | null = null

  async function ensureInit(): Promise<void> {
    if (_authInitialized) return
    if (_initPromise) return _initPromise
    _initPromise = _doInit().then(() => { _authInitialized = true })
    return _initPromise
  }

  async function _doInit(): Promise<void> {
    if (!process.env.SUI_PRIVATE_KEY) {
      throw new Error(
        "SUI_PRIVATE_KEY is required.\n\n" +
        "  Set SUI_PRIVATE_KEY=suiprivkey1... to authenticate.\n\n" +
        "  Export your private key from Sui Wallet → Settings → Accounts → Export Private Key."
      )
    }

    const { keypair, signer: ed25519Signer } = createEd25519Signer(process.env.SUI_PRIVATE_KEY)
    _realSigner = ed25519Signer

    process.stderr.write(`[fortem-mcp] Wallet address: ${_realSigner.getAddress()}\n`)
    process.stderr.write("[fortem-mcp] Logging in...\n")
    const token = await loginWithEd25519(client, keypair)
    client.setToken(token)
    process.stderr.write("[fortem-mcp] Login successful (Ed25519)\n")

    process.stderr.write("[fortem-mcp] Fetching developer API key...\n")
    const { apiKey } = await client.get<{ apiKey: string }>(
      "/api/v1/users/settings/developers/api-key"
    )
    _developerApiKey = apiKey
    process.stderr.write("[fortem-mcp] Developer API key ready\n")
  }

  // ── 3. Create HTTP client ─────────────────────────
  const client = new FortemClient(
    config.apiUrl,
    async () => {
      process.stderr.write("[fortem-mcp] Token expired, re-authenticating...\n")
      _authInitialized = false
      _initPromise = null
      await ensureInit()
      process.stderr.write("[fortem-mcp] Re-authentication successful\n")
    },
    ensureInit
  )

  // ── 4. Lazy signer proxy ──────────────────────────
  const lazySigner: Signer = {
    getAddress(): string {
      if (!_realSigner) throw new Error("Not authenticated. Ensure SUI_PRIVATE_KEY is set.")
      return _realSigner.getAddress()
    },
    async signTransaction(txBytes: string): Promise<string> {
      await ensureInit()
      return _realSigner!.signTransaction(txBytes)
    },
    async signPersonalMessage(messageBytes: Uint8Array): Promise<{ bytes: string; signature: string }> {
      await ensureInit()
      return _realSigner!.signPersonalMessage(messageBytes)
    },
  }

  // ── 5. Create MCP server ──────────────────────────
  const server = new McpServer({
    name: "fortem-mcp",
    version: "0.1.0",
  })

  // ── 6. Register tools ─────────────────────────────
  registerCollectionTools(server, client, lazySigner)
  registerItemTools(server, client, lazySigner)
  registerKioskTools(server, client, lazySigner)
  registerMarketTools(server, client, lazySigner)
  registerDeveloperTools(server, client, async () => {
    await ensureInit()
    return _developerApiKey
  })

  process.stderr.write("[fortem-mcp] Tools registered: [Personal] create_collection, get_my_collections, get_collection_detail, upload_image, mint_item, get_my_items, get_item_detail, ensure_kiosk, list_item | [Developer] get_developer_guide, get_my_api_key, verify_member, get_my_profile\n")

  // ── 7. Start server ───────────────────────────────
  const transport = new StdioServerTransport()
  await server.connect(transport)
  process.stderr.write("[fortem-mcp] Server started (stdio transport)\n")
}

main().catch((err) => {
  process.stderr.write(`[fortem-mcp] Fatal error: ${(err as Error).message}\n`)
  process.exit(1)
})

// ── Smithery sandbox export ───────────────────────
// Used by Smithery to scan tools without real credentials
export function createSandboxServer() {
  const server = new McpServer({ name: "fortem-mcp", version: "0.1.1" })

  const stubClient = new FortemClient("", async () => {}, undefined)
  const stubSigner: Signer = {
    getAddress: () => "0x0000000000000000000000000000000000000000",
    signTransaction: async () => "",
    signPersonalMessage: async () => ({ bytes: "", signature: "" }),
  }

  registerCollectionTools(server, stubClient, stubSigner)
  registerItemTools(server, stubClient, stubSigner)
  registerKioskTools(server, stubClient, stubSigner)
  registerMarketTools(server, stubClient, stubSigner)
  registerDeveloperTools(server, stubClient, async () => "YOUR_API_KEY")

  return server
}
