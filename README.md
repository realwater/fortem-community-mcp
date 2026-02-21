# fortem-mcp

An MCP (Model Context Protocol) server for the [Fortem](https://fortem.gg) NFT marketplace.

Connect Claude to Fortem and control your NFTs with natural language — create collections, mint items, manage your kiosk, and list items for sale. Also includes developer tools for integrating Fortem into your game or app.

---

## Quick Start

### Step 1 — Clone and build

```bash
git clone https://github.com/ForTemLabs/fortem-mcp.git
cd fortem-mcp
npm install
npm run build
```

### Step 2 — Get your Sui private key

You need a Sui wallet private key to authenticate. Export it from your wallet app:

- **Sui Wallet** → Settings → Accounts → Export Private Key
- **Suiet** → Settings → Export Private Key

The key starts with `suiprivkey1...`

> ⚠️ Keep this key safe. Anyone who has it can control your wallet.

### Step 3 — Connect to Claude

**Claude Code (terminal):**
```bash
claude mcp add fortem \
  -e SUI_PRIVATE_KEY=suiprivkey1... \
  -- node /absolute/path/to/fortem-mcp/dist/index.js
```

**Claude Desktop** — edit `~/Library/Application Support/Claude/claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "fortem": {
      "command": "node",
      "args": ["/absolute/path/to/fortem-mcp/dist/index.js"],
      "env": {
        "SUI_PRIVATE_KEY": "suiprivkey1..."
      }
    }
  }
}
```
Restart Claude Desktop after saving.

### Step 4 — Start using it

Open Claude and try:
```
Show my Fortem collections
```

---

## Available Tools

### Personal — Manage your own NFTs

These tools act on your own account (wallet address tied to `SUI_PRIVATE_KEY`).

| Tool | What it does |
|------|-------------|
| `create_collection` | Create a new NFT collection |
| `mint_item` | Mint an NFT item into a collection |
| `upload_image` | Upload an image for an item or collection |
| `ensure_kiosk` | Create a kiosk if you don't have one (required before listing) |
| `list_item` | List an NFT item for sale |
| `get_my_collections` | View your collections |
| `get_collection_detail` | View details of a specific collection |
| `get_my_items` | View your NFT inventory |
| `get_item_detail` | View details of a specific item |

### Developer — Integrate Fortem into your game or app

Use these tools when building a game or app that uses Fortem for monetization, NFT rewards, or item management.

| Tool | What it does |
|------|-------------|
| `get_developer_guide` | Get an integration guide (Direct API / JS SDK / Unity SDK) |
| `verify_member` | Check if a wallet address is a registered Fortem member |
| `get_my_profile` | Get your Fortem account profile |

---

## Example Prompts

**Personal use:**
```
Show me my Fortem collections

Create a new collection called "Summer Drop" with description "Limited edition summer NFTs"

Mint 10 items called "Summer Pass" in collection #5

Check if I have a kiosk, create one if I don't

List item #42 for 10 USDC

Show my items with status MINTED
```

**Developer / game integration:**
```
Show me the Fortem developer integration guide

I want to build an HTML5 game with Fortem — which SDK should I use?

Show me how to integrate Fortem into my Unity game

Is wallet 0xabc... a registered Fortem member?

What account is this MCP server authenticated as?
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SUI_PRIVATE_KEY` | — | **Required.** Your Sui wallet private key (`suiprivkey1...`) |
| `FORTEM_NETWORK` | `testnet` | `testnet` or `mainnet` |

### Testnet vs Mainnet

- Use **testnet** to try things out without real assets → [testnet.fortem.gg](https://testnet.fortem.gg)
- Use **mainnet** when working with real NFTs → [fortem.gg](https://fortem.gg)

```bash
# Testnet (default)
claude mcp add fortem \
  -e SUI_PRIVATE_KEY=suiprivkey1... \
  -- node /path/to/fortem-mcp/dist/index.js

# Mainnet
claude mcp add fortem \
  -e FORTEM_NETWORK=mainnet \
  -e SUI_PRIVATE_KEY=suiprivkey1... \
  -- node /path/to/fortem-mcp/dist/index.js
```

---

## Authentication

On startup, the server automatically:
1. Verifies your wallet is registered on Fortem
2. Signs a login message with your private key
3. Obtains a JWT access token
4. Re-authenticates transparently if the token expires

> **Note:** Your Fortem account must be created at [fortem.gg](https://fortem.gg) before using the MCP server.

### Google Login (Coming Soon)

Google ZK Login support is planned for a future release. For now, please use a Sui private key.

---

## Development / Debugging

Use MCP Inspector to call tools interactively in your browser:

```bash
npx @modelcontextprotocol/inspector \
  -e SUI_PRIVATE_KEY=suiprivkey1... \
  node /path/to/fortem-mcp/dist/index.js
```

Open `http://localhost:5173`.

---

## Networks

| Network | API Endpoint |
|---------|-------------|
| testnet | `https://testnet-api.fortem.gg` |
| mainnet | `https://api.fortem.gg` |

---

## Project Structure

```
src/
├── index.ts        — Entry point: auth, tool registration, server startup
├── auth.ts         — Ed25519 authentication flow
├── client.ts       — HTTP client with automatic token refresh
├── signer.ts       — Transaction signing abstraction
├── types.ts        — Shared types and network config
└── tools/
    ├── collection.ts  — [Personal] create_collection, get_my_collections, get_collection_detail
    ├── item.ts        — [Personal] upload_image, mint_item, get_my_items, get_item_detail
    ├── kiosk.ts       — [Personal] ensure_kiosk
    ├── market.ts      — [Personal] list_item
    └── developer.ts   — [Developer] get_developer_guide, verify_member, get_my_profile
```
