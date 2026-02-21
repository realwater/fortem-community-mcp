import { z } from "zod"
import { readFile } from "node:fs/promises"
import { basename } from "node:path"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { FortemClient } from "../client.js"
import type { Signer } from "../signer.js"
import type { TxResponse } from "../types.js"

interface UploadItemImageResponse {
  itemImage: string
}

interface MintItemResponse {
  itemId: number
  objectId: string
  name: string
  description: string
  collectionId: number
  userId: number
  nftNumber: number
  itemImage: string
  quantity: number
  redeemCode: string
  redeemUrl?: string
}

interface ItemSearchItem {
  id: number
  nftNumber: number
  name: string
  description: string
  itemImage: string
  quantity: number
  tradeVolume: string
  status: string
  createdAt: string
  collection: { id: number; name: string }
  kiosk?: {
    price: string
    priceTokenSymbol: string
    isPurchasePrice: boolean
    isItemSwap: boolean
  }
}

interface ItemDetail {
  id: number
  nftNumber: number
  name: string
  itemImage: string
  quantity: number
  status: string
  collection: {
    id: number
    name: string
    objectId: string
  }
  redeemUrl?: string
  kioskItemId?: number
  details: {
    objectId: string
    ownerAddress: string
    description: string
    attributes: Array<{ name: string; value: string }>
  }
  buy: {
    price: string
    priceUsd: string
    priceTokenSymbol: string
  }
}

function getMimeType(filename: string): string {
  const ext = filename.toLowerCase().split(".").pop()
  const mimeMap: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
  }
  return mimeMap[ext ?? ""] ?? "application/octet-stream"
}

export function registerItemTools(
  server: McpServer,
  client: FortemClient,
  signer: Signer
): void {
  // ──────────────────────────────────────────────
  // upload_image
  // ──────────────────────────────────────────────
  server.tool(
    "upload_image",
    "[Personal] Uploads a local image file to Fortem. Item images are stored on IPFS; collection images are stored on S3.",
    {
      filePath: z.string().describe("Absolute path to the local file to upload (e.g. /Users/me/image.png)"),
      type: z
        .enum(["item", "collection_logo", "collection_background"])
        .describe("Image type: item (NFT image), collection_logo (collection logo), collection_background (background)"),
    },
    async ({ filePath, type }) => {
      const buffer = await readFile(filePath)
      const filename = basename(filePath)
      const mimeType = getMimeType(filename)

      const formData = new FormData()
      const blob = new Blob([buffer], { type: mimeType })
      formData.append("file", blob, filename)

      const endpointMap = {
        item: "/api/v1/items/image-upload",
        collection_logo: "/api/v1/collections/image-upload/logo",
        collection_background: "/api/v1/collections/image-upload/background",
      } as const

      if (type === "item") {
        const result = await client.uploadFile<UploadItemImageResponse>(
          endpointMap[type],
          formData
        )
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  type: "item",
                  ipfsCid: result.itemImage,
                  note: "Use this CID as itemImage parameter in mint_item",
                },
                null,
                2
              ),
            },
          ],
        }
      } else {
        const s3Key = await client.uploadFile<string>(endpointMap[type], formData)
        const fieldName =
          type === "collection_logo" ? "logoImagePath" : "backgroundImagePath"
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  type,
                  s3Key,
                  note: `Use this value as ${fieldName} parameter in create_collection`,
                },
                null,
                2
              ),
            },
          ],
        }
      }
    }
  )

  // ──────────────────────────────────────────────
  // mint_item
  // ──────────────────────────────────────────────
  server.tool(
    "mint_item",
    "[Personal] Mints an NFT item into your collection. Automatically signs and executes the blockchain transaction.",
    {
      collectionId: z.number().int().positive().describe("Collection ID to add the item to"),
      name: z.string().max(40).describe("Item name (max 40 characters)"),
      description: z.string().max(1000).describe("Item description (max 1000 characters)"),
      quantity: z.number().int().positive().describe("Quantity to mint"),
      redeemCode: z
        .string()
        .regex(/^\S+$/, "redeemCode must not contain spaces")
        .describe("Redeem code without spaces (used when redeeming the item)"),
      redeemUrl: z.string().max(200).optional().describe("Redeem URL (max 200 characters, optional)"),
      itemImage: z
        .string()
        .optional()
        .describe("IPFS CID (ipfsCid value returned after uploading via upload_image tool)"),
      attributes: z
        .array(z.object({ name: z.string(), value: z.string() }))
        .optional()
        .describe("NFT attribute array (e.g. [{name: 'Level', value: '1'}])"),
    },
    async (params) => {
      // 1. prepare
      const prepared = await client.post<TxResponse>("/api/v1/items/mint/prepare", params)

      // 2. sign
      const signature = await signer.signTransaction(prepared.txBytes)

      // 3. execute
      const result = await client.post<MintItemResponse>("/api/v1/items/mint/execute", {
        txId: prepared.txId,
        txBytes: prepared.txBytes,
        signature,
      })

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                itemId: result.itemId,
                objectId: result.objectId,
                name: result.name,
                collectionId: result.collectionId,
                nftNumber: result.nftNumber,
                quantity: result.quantity,
                redeemCode: result.redeemCode,
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
  // get_my_items
  // ──────────────────────────────────────────────
  server.tool(
    "get_my_items",
    "[Personal] Retrieves your own NFT item inventory. Automatically filters to only your items based on the JWT token.",
    {
      status: z
        .enum(["PROCESSING", "MINTED", "REDEEMED", "OFFER_PENDING", "KIOSK_LISTED"])
        .optional()
        .describe("Item status filter"),
      collectionIds: z
        .array(z.number().int().positive())
        .optional()
        .describe("Filter by specific collection ID list"),
      query: z.string().optional().describe("Search query for item name"),
      skip: z.number().int().min(0).optional().default(0).describe("Pagination offset"),
      take: z.number().int().min(1).max(100).optional().default(10).describe("Number of results to fetch (max 100)"),
    },
    async ({ status, collectionIds, query, skip, take }) => {
      const params = new URLSearchParams()
      if (query) params.set("query", query)
      if (status) params.set("status", status)
      if (collectionIds?.length) params.set("collectionIds", collectionIds.join(","))
      params.set("skip", String(skip ?? 0))
      params.set("take", String(take ?? 10))

      const result = await client.get<ItemSearchItem[]>(`/api/v1/items?${params}`)

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
  // get_item_detail
  // ──────────────────────────────────────────────
  server.tool(
    "get_item_detail",
    "[Personal] Retrieves detailed information for a specific NFT item, including price, attributes, and on-chain objectId.",
    {
      itemId: z.number().int().positive().describe("Item ID"),
    },
    async ({ itemId }) => {
      const result = await client.get<ItemDetail>(`/api/v1/items/${itemId}`)

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
