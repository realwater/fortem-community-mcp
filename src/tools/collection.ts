import { z } from "zod"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { FortemClient } from "../client.js"
import type { Signer } from "../signer.js"
import type { TxResponse } from "../types.js"

interface CreateCollectionResponse {
  collectionId: number
  objectId: string
  name: string
  description: string
  logoImage: string
  backgroundImage: string
  tokenSymbols: string[]
  isDnaActivated: boolean
  purchaseFeeRate: number
}

interface CollectionHeader {
  id: number
  objectId: string
  name: string
  description: string
  backgroundImage: string
  logoImage: string
  tradeVolume: string
  itemCount: number
  isDnaActivated: boolean
  acceptedTokenSymbols: string[]
  purchaseFeeRate: number
  createdAt: string
}

interface CollectionListItem {
  id: number
  objectId: string
  name: string
  description: string
  backgroundImage: string
  logoImage: string
  tradeVolume: string
  itemCount: number
  createdAt: string
}

export function registerCollectionTools(
  server: McpServer,
  client: FortemClient,
  signer: Signer
): void {
  // ──────────────────────────────────────────────
  // create_collection
  // ──────────────────────────────────────────────
  server.tool(
    "create_collection",
    "Creates a new NFT collection. Automatically signs and executes the blockchain transaction.",
    {
      name: z.string().max(40).describe("Collection name (max 40 characters)"),
      description: z.string().max(1000).describe("Collection description (max 1000 characters)"),
      logoImagePath: z.string().optional().describe("Logo image path (value returned after uploading via upload_image tool)"),
      backgroundImagePath: z.string().optional().describe("Background image path (value returned after uploading via upload_image tool)"),
      tokenSymbols: z
        .array(z.enum(["SUI", "USDC", "USDT"]))
        .optional()
        .describe("Accepted payment tokens (default: USDC)"),
      isDnaActivated: z.boolean().optional().default(false).describe("Whether to activate the DNA feature"),
      purchaseFeeRate: z
        .union([z.literal(5), z.literal(10), z.literal(15), z.literal(20)])
        .optional()
        .describe("Purchase fee rate in % (choose from 5, 10, 15, 20)"),
    },
    async (params) => {
      // 1. prepare
      const prepared = await client.post<TxResponse>(
        "/api/v1/collections/create/prepare",
        params
      )

      // 2. sign
      const signature = await signer.signTransaction(prepared.txBytes)

      // 3. execute
      const result = await client.post<CreateCollectionResponse>(
        "/api/v1/collections/create/execute",
        { txId: prepared.txId, txBytes: prepared.txBytes, signature }
      )

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                collectionId: result.collectionId,
                objectId: result.objectId,
                name: result.name,
                description: result.description,
                tokenSymbols: result.tokenSymbols,
                isDnaActivated: result.isDnaActivated,
                purchaseFeeRate: result.purchaseFeeRate,
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
  // get_my_collections
  // ──────────────────────────────────────────────
  server.tool(
    "get_my_collections",
    "Retrieves your NFT collection list. Automatically filters to only your collections based on the JWT token.",
    {
      query: z.string().optional().describe("Search query for collection name"),
      skip: z.number().int().min(0).optional().default(0).describe("Pagination offset"),
      take: z.number().int().min(1).max(100).optional().default(10).describe("Number of results to fetch (max 100)"),
    },
    async ({ query, skip, take }) => {
      const params = new URLSearchParams()
      if (query) params.set("query", query)
      params.set("skip", String(skip ?? 0))
      params.set("take", String(take ?? 10))

      const result = await client.get<CollectionListItem[]>(`/api/v1/collections?${params}`)

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

  // ──────────────────────────────────────────────
  // get_collection_detail
  // ──────────────────────────────────────────────
  server.tool(
    "get_collection_detail",
    "Retrieves detailed information for a specific collection.",
    {
      collectionId: z.number().int().positive().describe("Collection ID"),
    },
    async ({ collectionId }) => {
      const result = await client.get<CollectionHeader>(
        `/api/v1/collections/${collectionId}/header`
      )

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
