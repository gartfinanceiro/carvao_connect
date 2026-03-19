const ZAPI_BASE = "https://api.z-api.io/instances"

export class ZApiClient {
  private instanceId: string
  private instanceToken: string
  private clientToken: string

  constructor(instanceId: string, instanceToken: string, clientToken: string) {
    this.instanceId = instanceId
    this.instanceToken = instanceToken
    this.clientToken = clientToken
  }

  private get baseUrl() {
    return `${ZAPI_BASE}/${this.instanceId}/token/${this.instanceToken}`
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "Client-Token": this.clientToken,
        ...options?.headers,
      },
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Z-API error ${res.status}: ${text}`)
    }

    return res.json()
  }

  async getQrCode(): Promise<{ connected: boolean; value: string | null }> {
    return this.request("/qr-code/image")
  }

  async getStatus(): Promise<{
    connected: boolean
    smartphoneConnected: boolean
    session: boolean
  }> {
    return this.request("/status")
  }

  async disconnect(): Promise<{ value: boolean }> {
    return this.request("/disconnect")
  }

  async restart(): Promise<{ value: boolean }> {
    return this.request("/restart")
  }

  async updateWebhook(webhookUrl: string): Promise<unknown> {
    return this.request("/update-webhook-received", {
      method: "PUT",
      body: JSON.stringify({ value: webhookUrl }),
    })
  }
}
