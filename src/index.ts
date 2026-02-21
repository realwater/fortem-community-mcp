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

  // ── 2. Auth state ─────────────────────────────────
  let signer: Signer
  let loginFn: () => Promise<string>

  // ── 3. Create HTTP client ─────────────────────────
  // Deferred binding: onUnauthorized is set after signer is initialized
  let cachedLoginFn: (() => Promise<string>) | null = null
  const client = new FortemClient(config.apiUrl, async () => {
    process.stderr.write("[fortem-mcp] Token expired, re-authenticating...\n")
    if (!cachedLoginFn) throw new Error("Login function not initialized")
    const token = await cachedLoginFn()
    client.setToken(token)
    process.stderr.write("[fortem-mcp] Re-authentication successful\n")
  })

  // ── 4. Initial authentication ─────────────────────
  if (process.env.SUI_PRIVATE_KEY) {
    // Ed25519 mode
    process.stderr.write("[fortem-mcp] Auth mode: Ed25519 (SUI_PRIVATE_KEY)\n")
    const { keypair, signer: ed25519Signer } = createEd25519Signer(process.env.SUI_PRIVATE_KEY)

    signer = ed25519Signer
    loginFn = () => loginWithEd25519(client, keypair)
    cachedLoginFn = loginFn

    process.stderr.write(`[fortem-mcp] Wallet address: ${signer.getAddress()}\n`)
    process.stderr.write("[fortem-mcp] Logging in...\n")

    const token = await loginFn()
    client.setToken(token)
    process.stderr.write("[fortem-mcp] Login successful (Ed25519)\n")
  } else {
    throw new Error(
      "SUI_PRIVATE_KEY is required.\n\n" +
      "  Set SUI_PRIVATE_KEY=suiprivkey1... to authenticate.\n\n" +
      "  Export your private key from Sui Wallet → Settings → Accounts → Export Private Key."
    )
  }

  // ── 5. Create MCP server ──────────────────────────
  const server = new McpServer({
    name: "fortem-mcp",
    version: "0.1.0",
  })

  // ── 6. Register tools ─────────────────────────────
  // [Personal] tools — manage your own collections, items, kiosk, and listings
  registerCollectionTools(server, client, signer)
  registerItemTools(server, client, signer)
  registerKioskTools(server, client, signer)
  registerMarketTools(server, client, signer)

  // [Developer] tools — integrate Fortem into games and apps
  registerDeveloperTools(server, client)

  process.stderr.write("[fortem-mcp] Tools registered: [Personal] create_collection, get_my_collections, get_collection_detail, upload_image, mint_item, get_my_items, get_item_detail, ensure_kiosk, list_item | [Developer] get_developer_guide, verify_member, get_my_profile\n")

  // ── 7. Start server ───────────────────────────────
  const transport = new StdioServerTransport()
  await server.connect(transport)
  process.stderr.write("[fortem-mcp] Server started (stdio transport)\n")
}

main().catch((err) => {
  process.stderr.write(`[fortem-mcp] Fatal error: ${(err as Error).message}\n`)
  process.exit(1)
})
