import { z } from "zod"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { FortemClient } from "../client.js"
import type { Signer } from "../signer.js"
import type { TxResponse } from "../types.js"

interface KioskExistsResponse {
  exists: boolean
}

interface ListItemResponse {
  itemId: number
  kioskItemId: number
  sellingPrice: number
  sellingTokenSymbol: string
  enableTrading: boolean
  listedAt: string
}

export function registerMarketTools(
  server: McpServer,
  client: FortemClient,
  signer: Signer
): void {
  // ──────────────────────────────────────────────
  // list_item
  // ──────────────────────────────────────────────
  server.tool(
    "list_item",
    "Lists an NFT item for sale in your kiosk. Run ensure_kiosk first if you don't have a kiosk yet.",
    {
      itemId: z.number().int().positive().describe("ID of the item to list for sale"),
      sellingPrice: z
        .number()
        .min(0)
        .describe("Selling price (set to 0 with enableTrading=true for trade-only listing)"),
      sellingTokenSymbol: z
        .enum(["SUI", "USDC", "USDT"])
        .optional()
        .default("USDC")
        .describe("Payment token (default: USDC)"),
      enableTrading: z.boolean().describe("Whether to allow item swapping (trade)"),
    },
    async ({ itemId, sellingPrice, sellingTokenSymbol, enableTrading }) => {
      // Check kiosk exists
      const { exists } = await client.get<KioskExistsResponse>("/api/v1/kiosks/exists")
      if (!exists) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: false,
                  error: "Kiosk does not exist. Please run ensure_kiosk first.",
                },
                null,
                2
              ),
            },
          ],
        }
      }

      // 1. prepare
      const prepared = await client.post<TxResponse>(
        `/api/v1/items/${itemId}/list/prepare`,
        { sellingPrice, sellingTokenSymbol: sellingTokenSymbol ?? "USDC", enableTrading }
      )

      // 2. sign
      const signature = await signer.signTransaction(prepared.txBytes)

      // 3. execute
      const result = await client.post<ListItemResponse>("/api/v1/items/list/execute", {
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
                kioskItemId: result.kioskItemId,
                sellingPrice: result.sellingPrice,
                sellingTokenSymbol: result.sellingTokenSymbol,
                enableTrading: result.enableTrading,
                listedAt: result.listedAt,
              },
              null,
              2
            ),
          },
        ],
      }
    }
  )
}
