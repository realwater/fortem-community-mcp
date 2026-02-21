import { createServer } from "node:http"
import { exec } from "node:child_process"
import { randomBytes, createHash } from "node:crypto"

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"

// Desktop app OAuth clients support any localhost port without explicit registration.
const CALLBACK_PORT = 8898
const REDIRECT_URI = `http://localhost:${CALLBACK_PORT}/callback`
const CALLBACK_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes

function openBrowser(url: string): void {
  const platform = process.platform
  const cmd = platform === "win32" ? "start" : platform === "darwin" ? "open" : "xdg-open"
  exec(`${cmd} "${url}"`)
}

async function waitForOAuthCode(): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      if (!req.url) return

      const url = new URL(req.url, `http://localhost:${CALLBACK_PORT}`)
      if (url.pathname !== "/callback") return

      const code = url.searchParams.get("code")
      const error = url.searchParams.get("error")

      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })

      if (code) {
        res.end(
          "<html><body><h2>Authentication successful! You can close this tab.</h2></body></html>"
        )
        clearTimeout(timer)
        server.close()
        resolve(code)
      } else {
        res.end(
          `<html><body><h2>Authentication failed: ${error ?? "unknown error"}</h2></body></html>`
        )
        clearTimeout(timer)
        server.close()
        reject(new Error(`Google OAuth error: ${error ?? "unknown"}`))
      }
    })

    const timer = setTimeout(() => {
      server.close()
      reject(new Error("Google OAuth callback timeout (5 minutes exceeded)"))
    }, CALLBACK_TIMEOUT_MS)

    server.on("error", (err) => {
      clearTimeout(timer)
      reject(new Error(`Failed to start callback server on port ${CALLBACK_PORT}: ${err.message}`))
    })

    server.listen(CALLBACK_PORT, "localhost")
  })
}

/**
 * Launches a browser-based Google OAuth flow with the given ZK Login nonce embedded.
 * The returned ID token will have the nonce in its claims, which is required for the ZK prover.
 *
 * Uses PKCE (no client secret needed — Desktop app OAuth client type).
 *
 * @param nonce - ZK Login nonce generated from the ephemeral keypair
 */
export async function getGoogleIdToken(nonce: string): Promise<string> {
  // PKCE parameters
  const codeVerifier = randomBytes(32).toString("base64url")
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url")

  const authUrl = new URL(GOOGLE_AUTH_URL)
  authUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID)
  authUrl.searchParams.set("redirect_uri", REDIRECT_URI)
  authUrl.searchParams.set("response_type", "code")
  authUrl.searchParams.set("scope", "openid email")
  authUrl.searchParams.set("nonce", nonce)
  authUrl.searchParams.set("code_challenge", codeChallenge)
  authUrl.searchParams.set("code_challenge_method", "S256")
  authUrl.searchParams.set("access_type", "offline")
  authUrl.searchParams.set("prompt", "select_account")

  process.stderr.write("[fortem-mcp] Opening browser for Google login...\n")
  process.stderr.write(
    `[fortem-mcp] If the browser does not open automatically, visit:\n  ${authUrl.toString()}\n`
  )

  openBrowser(authUrl.toString())

  process.stderr.write(
    `[fortem-mcp] Waiting for Google callback on port ${CALLBACK_PORT} (timeout: 5 minutes)...\n`
  )

  const code = await waitForOAuthCode()

  process.stderr.write("[fortem-mcp] Google OAuth code received, exchanging for tokens...\n")

  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
      code_verifier: codeVerifier,
    }),
  })

  if (!tokenRes.ok) {
    const body = await tokenRes.text()
    throw new Error(`Token exchange failed (${tokenRes.status}): ${body}`)
  }

  const tokens = (await tokenRes.json()) as { id_token?: string }

  if (!tokens.id_token) {
    throw new Error("No id_token in Google token response")
  }

  process.stderr.write("[fortem-mcp] Google ID token obtained successfully\n")
  return tokens.id_token
}
