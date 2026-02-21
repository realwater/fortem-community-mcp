import { z } from "zod"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { FortemClient } from "../client.js"
import type { Signer } from "../signer.js"
import type { TxResponse } from "../types.js"

interface KioskExistsResponse {
  exists: boolean
}

interface CreateKioskResponse {
  kioskId: number
  objectId: string
}

export function registerKioskTools(
  server: McpServer,
  client: FortemClient,
  signer: Signer
): void {
  // ──────────────────────────────────────────────
  // ensure_kiosk
  // ──────────────────────────────────────────────
  server.tool(
    "ensure_kiosk",
    "Creates a kiosk if one does not exist. Skips creation if it already exists (idempotent). A kiosk is required to list items for sale.",
    {},
    async () => {
      // 1. Check if kiosk exists
      const { exists } = await client.get<KioskExistsResponse>("/api/v1/kiosks/exists")

      if (exists) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  exists: true,
                  created: false,
                  message: "Kiosk already exists, skipped creation",
                },
                null,
                2
              ),
            },
          ],
        }
      }

      // 2. prepare (no request body; sponsored transaction — server covers gas)
      const prepared = await client.post<TxResponse>("/api/v1/kiosks/create/prepare", {})

      // 3. User signature (sponsorSignature is handled automatically by the server)
      const signature = await signer.signTransaction(prepared.txBytes)

      // 4. execute
      const result = await client.post<CreateKioskResponse>("/api/v1/kiosks/create/execute", {
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
                exists: false,
                created: true,
                kioskId: result.kioskId,
                objectId: result.objectId,
                message: "Kiosk created successfully",
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
