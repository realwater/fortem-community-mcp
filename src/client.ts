import type { ApiResponse } from "./types.js"

export class FortemClient {
  private accessToken: string | null = null

  constructor(
    private readonly apiUrl: string,
    private readonly onUnauthorized: () => Promise<void>,
    private readonly onBeforeRequest?: () => Promise<void>
  ) {}

  setToken(token: string): void {
    this.accessToken = token
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: "GET" })
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>(path, {
      method: "POST",
      body: JSON.stringify(body),
    })
  }

  async put<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>(path, {
      method: "PUT",
      body: JSON.stringify(body),
    })
  }

  async uploadFile<T>(path: string, formData: FormData): Promise<T> {
    // Do NOT set Content-Type — let fetch set it with the correct multipart boundary
    return this.request<T>(path, {
      method: "PUT",
      body: formData,
      headers: {},
    }, true, true)
  }

  private async request<T>(
    path: string,
    options: RequestInit,
    retry = true,
    isMultipart = false
  ): Promise<T> {
    if (retry) await this.onBeforeRequest?.()

    const headers: Record<string, string> = {}

    if (!isMultipart) {
      headers["Content-Type"] = "application/json"
    }

    if (this.accessToken) {
      headers["Authorization"] = `Bearer ${this.accessToken}`
    }

    const res = await fetch(`${this.apiUrl}${path}`, {
      ...options,
      headers: {
        ...headers,
        ...(options.headers as Record<string, string> ?? {}),
      },
    })

    if (res.status === 401 && retry) {
      await this.onUnauthorized()
      return this.request<T>(path, options, false, isMultipart)
    }

    if (!res.ok) {
      const errorText = await res.text()
      throw new Error(`Fortem API Error ${res.status}: ${errorText}`)
    }

    const json = (await res.json()) as ApiResponse<T>
    return json.data
  }
}
