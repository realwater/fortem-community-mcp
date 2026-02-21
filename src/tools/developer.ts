import { z } from "zod"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { FortemClient } from "../client.js"

interface CheckWalletResponse {
  exists: boolean
  walletAddress: string
}

interface UserProfile {
  id: number
  walletAddress: string
  nickname: string
  profileImage: string
  email?: string
  createdAt: string
}

interface ApiKeyResponse {
  apiKey: string
}

function buildGuideAll(apiKey: string): string {
  return `
# Fortem Developer Integration Guide

Your API key: \`${apiKey}\`

Fortem provides three integration paths depending on your use case:

---

## Option 1 — Direct Developer API

Best for: custom backends, server-side integrations, non-game contexts.

**Getting started:**
Use your API key in the Authorization header for every request.

**Base URLs:**
- Testnet: https://testnet-api.fortem.gg
- Mainnet: https://api.fortem.gg

**Key endpoints:**
- \`GET  /api/v1/users?walletAddress={address}\` — verify a member
- \`GET  /api/v1/collections\` — list collections
- \`POST /api/v1/collections/create/prepare\` + \`execute\` — create a collection
- \`GET  /api/v1/items\` — list items
- \`POST /api/v1/items/mint/prepare\` + \`execute\` — mint items

**Docs:** https://docs.fortem.gg

---

## Option 2 — JS SDK (HTML / Web Games)

Best for: browser-based games, HTML5 games, web apps.

**Installation:**
\`\`\`bash
npm install @fortemlabs/sdk-js
\`\`\`

**Quick start:**
\`\`\`typescript
import { createFortemClient } from "@fortemlabs/sdk-js"

const fortem = createFortemClient({ apiKey: "${apiKey}" })
\`\`\`

**Rate limits:** 100 collection requests/day · 1,000 item requests/day

**GitHub:** https://github.com/ForTemLabs/sdk-js

---

## Option 3 — Unity SDK

Best for: Unity games (minimum Unity 2021.2).

**Installation via Unity Package Manager:**
\`\`\`
https://github.com/ForTemLabs/fortem-sdk-unity.git?path=Packages/com.fortem.fortem-sdk
\`\`\`

Use API key: \`${apiKey}\`

**GitHub:** https://github.com/ForTemLabs/fortem-sdk-unity
**Docs:** https://docs.fortem.gg

---

Use \`get_developer_guide\` with option "1", "2", or "3" to see a focused guide for each path.
`.trim()
}

function buildGuide1(apiKey: string): string {
  return `
# Option 1 — Direct Developer API

Best for: custom backends, server-side integrations, non-game contexts.

## Authentication

Include your API key in every request:
\`\`\`
Authorization: Bearer ${apiKey}
\`\`\`

## Base URLs

| Network  | URL                              |
|----------|----------------------------------|
| Testnet  | https://testnet-api.fortem.gg    |
| Mainnet  | https://api.fortem.gg            |

## Core endpoints

### User verification
\`\`\`
GET /api/v1/auth/check-wallet?walletAddress={address}
\`\`\`
Returns \`{ exists: boolean, walletAddress: string }\`

### Collections
\`\`\`
GET  /api/v1/collections              # list
GET  /api/v1/collections/:id/header   # detail
POST /api/v1/collections/create/prepare
POST /api/v1/collections/create/execute
\`\`\`

### Items
\`\`\`
GET  /api/v1/items                    # list
GET  /api/v1/items/:id                # detail
POST /api/v1/items/mint/prepare
POST /api/v1/items/mint/execute
PUT  /api/v1/items/image-upload       # IPFS upload
\`\`\`

### Market
\`\`\`
GET  /api/v1/kiosks/exists
POST /api/v1/kiosks/create/prepare
POST /api/v1/kiosks/create/execute
POST /api/v1/items/:id/list/prepare
POST /api/v1/items/list/execute
\`\`\`

## Docs

https://docs.fortem.gg
`.trim()
}

function buildGuide2(apiKey: string): string {
  return `
# Option 2 — JS SDK (HTML / Web Games)

Best for: browser-based games, HTML5 games, web apps.

## Installation

\`\`\`bash
npm install @fortemlabs/sdk-js
# or
yarn add @fortemlabs/sdk-js
pnpm add @fortemlabs/sdk-js
\`\`\`

## Authentication

\`\`\`typescript
import { createFortemClient } from "@fortemlabs/sdk-js"

const fortem = createFortemClient({ apiKey: "${apiKey}" })
\`\`\`

The client automatically caches the token (5-minute TTL) and refreshes it as needed.

## Key APIs

\`\`\`typescript
// Verify a game player
const { exists } = await fortem.users.checkWallet("0xPlayerWalletAddress")

// List collections
const collections = await fortem.collections.list()

// Create a collection
await fortem.collections.create({ name: "Season 1", description: "..." })

// List items
const items = await fortem.items.list({ collectionId: 1 })

// Mint an item
await fortem.items.create({
  collectionId: 1,
  name: "Gold Sword",
  description: "Rare weapon",
  quantity: 1,
  redeemCode: "GOLDSWORD01",
})

// Upload an image
await fortem.items.uploadImage(file)
\`\`\`

## Rate limits

| Resource    | Limit           |
|-------------|-----------------|
| Collections | 100 req / day   |
| Items       | 1,000 req / day |

## Error handling

\`\`\`typescript
import { FortemAuthError, FortemTokenExpiredError } from "@fortemlabs/sdk-js"

try {
  await fortem.items.create(...)
} catch (e) {
  if (e instanceof FortemAuthError) { /* invalid API key */ }
  if (e instanceof FortemTokenExpiredError) { /* auto-refresh failed */ }
}
\`\`\`

## GitHub

https://github.com/ForTemLabs/sdk-js
`.trim()
}

function buildGuide3(apiKey: string): string {
  return `
# Option 3 — Unity SDK

Best for: Unity games (minimum Unity 2021.2).

## Installation

### Via Unity Package Manager (recommended)

1. Open **Window → Package Manager**
2. Click **+** → **Add package from git URL**
3. Paste:
   \`\`\`
   https://github.com/ForTemLabs/fortem-sdk-unity.git?path=Packages/com.fortem.fortem-sdk
   \`\`\`
4. Click **Add**

To pin a specific version, append a version tag:
\`\`\`
https://github.com/ForTemLabs/fortem-sdk-unity.git?path=Packages/com.fortem.fortem-sdk#1.0.0
\`\`\`

## Your API Key

\`\`\`
${apiKey}
\`\`\`

## Requirements

- Unity 2021.2 or later

## GitHub

https://github.com/ForTemLabs/fortem-sdk-unity

## Docs

https://docs.fortem.gg
`.trim()
}

export function registerDeveloperTools(
  server: McpServer,
  client: FortemClient,
  getDeveloperApiKey: () => Promise<string>
): void {
  // ──────────────────────────────────────────────
  // get_developer_guide
  // ──────────────────────────────────────────────
  server.tool(
    "get_developer_guide",
    "[Developer] Get a guide for integrating Fortem into your game or app — for monetization, NFT rewards, and item management. Includes your actual API key in code examples. Choose from three integration paths: Direct API, JS SDK (HTML/web games), or Unity SDK.",
    {
      option: z
        .enum(["1", "2", "3"])
        .optional()
        .describe(
          "Integration option: 1=Direct Developer API, 2=JS SDK for HTML/web games, 3=Unity SDK. Omit to see an overview of all options."
        ),
    },
    async ({ option }) => {
      const apiKey = await getDeveloperApiKey()
      const guide =
        option === "1" ? buildGuide1(apiKey) :
        option === "2" ? buildGuide2(apiKey) :
        option === "3" ? buildGuide3(apiKey) :
        buildGuideAll(apiKey)

      return { content: [{ type: "text", text: guide }] }
    }
  )

  // ──────────────────────────────────────────────
  // get_my_api_key
  // ──────────────────────────────────────────────
  server.tool(
    "get_my_api_key",
    "[Developer] Get your Fortem Developer API key. Use this key to authenticate requests from the JS SDK, Unity SDK, or direct REST API calls. Pass regenerate=true to issue a new key (the old key will be invalidated).",
    {
      regenerate: z
        .boolean()
        .optional()
        .default(false)
        .describe("Set to true to generate a new API key (invalidates the current one)"),
    },
    async ({ regenerate }) => {
      let apiKey: string

      if (regenerate) {
        const result = await client.put<ApiKeyResponse>(
          "/api/v1/users/settings/developers/api-key",
          {}
        )
        apiKey = result.apiKey
      } else {
        const result = await client.get<ApiKeyResponse>(
          "/api/v1/users/settings/developers/api-key"
        )
        apiKey = result.apiKey
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                apiKey,
                regenerated: regenerate ?? false,
                note: regenerate
                  ? "A new API key has been issued. Update your SDK configuration with this key."
                  : "Use this key in createFortemClient({ apiKey }) or as Authorization: Bearer <key>.",
              },
              null,
              2
            ),
          },
        ],
      }
    }
  )

  // ──────────────────────────────────────────────
  // verify_member
  // ──────────────────────────────────────────────
  server.tool(
    "verify_member",
    "[Developer] Check whether a Sui wallet address is a registered Fortem member. Use this in your game to verify players before granting them access to Fortem-powered features.",
    {
      walletAddress: z
        .string()
        .describe("Sui wallet address to verify (starts with 0x)"),
    },
    async ({ walletAddress }) => {
      const result = await client.post<CheckWalletResponse>("/api/v1/auth/check-wallet", {
        walletAddress,
      })

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                walletAddress: result.walletAddress,
                isMember: result.exists,
                message: result.exists
                  ? "This address is a registered Fortem member."
                  : "This address is not registered on Fortem. Direct them to https://fortem.gg to sign up.",
              },
              null,
              2
            ),
          },
        ],
      }
    }
  )

  // ──────────────────────────────────────────────
  // get_my_profile
  // ──────────────────────────────────────────────
  server.tool(
    "get_my_profile",
    "[Developer] Get your Fortem account profile — wallet address, nickname, and account info. Useful for confirming which account the MCP server is authenticated as.",
    {},
    async () => {
      const result = await client.get<UserProfile>("/api/v1/users/me")

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      }
    }
  )

}
