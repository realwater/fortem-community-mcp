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

const GUIDE_ALL = `
# Fortem Developer Integration Guide

Fortem provides three integration paths depending on your use case:

---

## Option 1 — Direct Developer API

Best for: custom backends, server-side integrations, non-game contexts.

**Getting started:**
1. Sign in at https://fortem.gg and go to **Developer Settings** to generate an API key.
2. Call the REST API directly with your API key in the Authorization header.

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
# or
yarn add @fortemlabs/sdk-js
\`\`\`

**Quick start:**
\`\`\`typescript
import { createFortemClient } from "@fortemlabs/sdk-js"

const fortem = createFortemClient({ apiKey: "your-api-key" })

// Verify a player
const user = await fortem.users.getByWallet("0x...")

// List your collections
const collections = await fortem.collections.list()

// Mint an item
await fortem.items.create({ collectionId: 1, name: "Sword", quantity: 1, redeemCode: "SWORD01" })
\`\`\`

**Rate limits:** 100 collection requests/day · 1,000 item requests/day

**GitHub:** https://github.com/ForTemLabs/sdk-js

---

## Option 3 — Unity SDK

Best for: Unity games (minimum Unity 2021.2).

**Installation via Unity Package Manager:**
1. Open **Window → Package Manager**
2. Click **+** → **Add package from git URL**
3. Enter:
\`\`\`
https://github.com/ForTemLabs/fortem-sdk-unity.git?path=Packages/com.fortem.fortem-sdk
\`\`\`
   To pin a specific version append a tag, e.g. \`#1.0.0\`

**GitHub:** https://github.com/ForTemLabs/fortem-sdk-unity
**Docs:** https://docs.fortem.gg

---

Use \`get_developer_guide\` with option "1", "2", or "3" to see a focused guide for each path.
`.trim()

const GUIDE_1 = `
# Option 1 — Direct Developer API

Best for: custom backends, server-side integrations, non-game contexts.

## Getting started

1. Sign in at https://fortem.gg and go to **Developer Settings** to generate an API key.
2. Include the key in every request:
   \`Authorization: Bearer <your-api-key>\`

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

const GUIDE_2 = `
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

Get an API key from **https://fortem.gg → Developer Settings**.

\`\`\`typescript
import { createFortemClient } from "@fortemlabs/sdk-js"

const fortem = createFortemClient({ apiKey: "your-api-key" })
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

const GUIDE_3 = `
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

## Getting started

After installation, find the full getting started guide inside the package's **Documentation** folder,
or visit https://docs.fortem.gg.

## Requirements

- Unity 2021.2 or later
- A Fortem API key (get one at https://fortem.gg → Developer Settings)

## GitHub

https://github.com/ForTemLabs/fortem-sdk-unity

## Docs

https://docs.fortem.gg
`.trim()

const GUIDES: Record<string, string> = { "1": GUIDE_1, "2": GUIDE_2, "3": GUIDE_3 }

export function registerDeveloperTools(server: McpServer, client: FortemClient): void {
  // ──────────────────────────────────────────────
  // get_developer_guide
  // ──────────────────────────────────────────────
  server.tool(
    "get_developer_guide",
    "[Developer] Get a guide for integrating Fortem into your game or app — for monetization, NFT rewards, and item management. Choose from three integration paths: Direct API, JS SDK (HTML/web games), or Unity SDK.",
    {
      option: z
        .enum(["1", "2", "3"])
        .optional()
        .describe(
          "Integration option to focus on: 1=Direct Developer API, 2=JS SDK for HTML/web games, 3=Unity SDK. Omit to see an overview of all options."
        ),
    },
    async ({ option }) => {
      const guide = option ? GUIDES[option] : GUIDE_ALL
      return { content: [{ type: "text", text: guide }] }
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
