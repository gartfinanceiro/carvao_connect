/**
 * Meta WhatsApp Cloud API Client
 * Substitui o antigo lib/zapi.ts
 *
 * Documentação: https://developers.facebook.com/docs/whatsapp/cloud-api
 * Graph API version: v21.0
 */

const GRAPH_API_BASE = "https://graph.facebook.com/v21.0"

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MetaWebhookEntry {
  id: string // WABA ID
  changes: MetaWebhookChange[]
}

export interface MetaWebhookChange {
  value: MetaWebhookValue
  field: string // "messages"
}

export interface MetaWebhookValue {
  messaging_product: "whatsapp"
  metadata: {
    display_phone_number: string
    phone_number_id: string
  }
  contacts?: MetaWebhookContact[]
  messages?: MetaWebhookMessage[]
  statuses?: MetaWebhookStatus[]
  errors?: MetaWebhookError[]
}

export interface MetaWebhookContact {
  profile: { name: string }
  wa_id: string
}

export interface MetaWebhookMessage {
  from: string
  id: string
  timestamp: string
  type: "text" | "image" | "audio" | "video" | "document" | "location" | "contacts" | "sticker" | "reaction" | "interactive" | "button" | "order" | "unknown"
  text?: { body: string }
  image?: MetaMediaPayload
  audio?: MetaMediaPayload
  video?: MetaMediaPayload
  document?: MetaMediaPayload & { filename?: string }
  sticker?: MetaMediaPayload
  location?: { latitude: number; longitude: number; name?: string; address?: string }
  contacts?: unknown[]
  context?: { from: string; id: string }
  errors?: MetaWebhookError[]
}

export interface MetaMediaPayload {
  id: string
  mime_type: string
  sha256?: string
  caption?: string
}

export interface MetaWebhookStatus {
  id: string
  status: "sent" | "delivered" | "read" | "failed"
  timestamp: string
  recipient_id: string
  errors?: MetaWebhookError[]
  conversation?: {
    id: string
    origin: { type: string }
    expiration_timestamp?: string
  }
  pricing?: {
    billable: boolean
    pricing_model: string
    category: string
  }
}

export interface MetaWebhookError {
  code: number
  title: string
  message: string
  error_data?: { details: string }
}

export interface MetaWebhookPayload {
  object: "whatsapp_business_account"
  entry: MetaWebhookEntry[]
}

export interface SendMessageResponse {
  messaging_product: "whatsapp"
  contacts: { input: string; wa_id: string }[]
  messages: { id: string }[]
}

export interface PhoneNumberInfo {
  id: string
  display_phone_number: string
  verified_name: string
  quality_rating: "GREEN" | "YELLOW" | "RED"
  messaging_limit?: string
  platform_type?: string
  code_verification_status?: string
}

export interface EmbeddedSignupResult {
  waba_id: string
  phone_number_id: string
  access_token: string
  token_expires_at?: string
}

// ─── Client ──────────────────────────────────────────────────────────────────

export class MetaWhatsAppClient {
  private accessToken: string
  private phoneNumberId: string

  constructor(accessToken: string, phoneNumberId: string) {
    this.accessToken = accessToken
    this.phoneNumberId = phoneNumberId
  }

  private async request<T>(
    path: string,
    options?: RequestInit
  ): Promise<T> {
    const url = path.startsWith("http") ? path : `${GRAPH_API_BASE}${path}`
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.accessToken}`,
        ...options?.headers,
      },
    })

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: { message: res.statusText } }))
      throw new MetaApiError(
        error.error?.message || `HTTP ${res.status}`,
        error.error?.code,
        error.error?.error_subcode,
        res.status
      )
    }

    return res.json()
  }

  // ─── Mensagens ───────────────────────────────────────────────────────

  /** Enviar mensagem de texto */
  async sendTextMessage(to: string, body: string): Promise<SendMessageResponse> {
    return this.request(`/${this.phoneNumberId}/messages`, {
      method: "POST",
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: normalizePhone(to),
        type: "text",
        text: { preview_url: false, body },
      }),
    })
  }

  /** Enviar template de mensagem */
  async sendTemplate(
    to: string,
    templateName: string,
    languageCode: string = "pt_BR",
    components?: Record<string, unknown>[]
  ): Promise<SendMessageResponse> {
    return this.request(`/${this.phoneNumberId}/messages`, {
      method: "POST",
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: normalizePhone(to),
        type: "template",
        template: {
          name: templateName,
          language: { code: languageCode },
          ...(components ? { components } : {}),
        },
      }),
    })
  }

  /** Marcar mensagem como lida */
  async markAsRead(messageId: string): Promise<{ success: boolean }> {
    return this.request(`/${this.phoneNumberId}/messages`, {
      method: "POST",
      body: JSON.stringify({
        messaging_product: "whatsapp",
        status: "read",
        message_id: messageId,
      }),
    })
  }

  // ─── Mídia ───────────────────────────────────────────────────────────

  /** Obter URL de download de mídia */
  async getMediaUrl(mediaId: string): Promise<{ url: string; mime_type: string; sha256: string; file_size: number }> {
    return this.request(`/${mediaId}`)
  }

  /** Baixar mídia */
  async downloadMedia(mediaUrl: string): Promise<ArrayBuffer> {
    const res = await fetch(mediaUrl, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    })
    if (!res.ok) throw new MetaApiError(`Download failed: ${res.status}`, undefined, undefined, res.status)
    return res.arrayBuffer()
  }

  // ─── Info do Número ──────────────────────────────────────────────────

  /** Obter informações do número de telefone */
  async getPhoneNumberInfo(): Promise<PhoneNumberInfo> {
    return this.request(
      `/${this.phoneNumberId}?fields=display_phone_number,verified_name,quality_rating,messaging_limit,platform_type,code_verification_status`
    )
  }

  /** Obter perfil do business */
  async getBusinessProfile(): Promise<Record<string, unknown>> {
    return this.request(
      `/${this.phoneNumberId}/whatsapp_business_profile?fields=about,address,description,email,profile_picture_url,websites,vertical`
    )
  }

  // ─── Templates ───────────────────────────────────────────────────────

  /** Listar templates de mensagem */
  async listTemplates(wabaId: string): Promise<{ data: Record<string, unknown>[] }> {
    return this.request(
      `/${wabaId}/message_templates?fields=name,status,category,language,components`
    )
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export class MetaApiError extends Error {
  code?: number
  subcode?: number
  httpStatus: number

  constructor(message: string, code?: number, subcode?: number, httpStatus: number = 500) {
    super(message)
    this.name = "MetaApiError"
    this.code = code
    this.subcode = subcode
    this.httpStatus = httpStatus
  }
}

/** Normaliza telefone para formato E.164 (somente dígitos, com código do país) */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  // Se já começa com 55 (Brasil) e tem 12-13 dígitos, retorna como está
  if (digits.startsWith("55") && digits.length >= 12) return digits
  // Se tem 10-11 dígitos (DDD + número), adiciona 55
  if (digits.length >= 10 && digits.length <= 11) return `55${digits}`
  return digits
}

/** Mapeia tipo de mensagem da Meta para o tipo interno */
export function mapMessageType(
  metaType: MetaWebhookMessage["type"]
): "text" | "audio" | "image" | "document" | "location" | "contact" | "sticker" | "other" {
  switch (metaType) {
    case "text":
      return "text"
    case "audio":
      return "audio"
    case "image":
      return "image"
    case "video":
      return "document" // vídeo tratado como documento
    case "document":
      return "document"
    case "location":
      return "location"
    case "contacts":
      return "contact"
    case "sticker":
      return "sticker"
    default:
      return "other"
  }
}

/** Extrai conteúdo textual de uma mensagem da Meta */
export function extractMessageContent(message: MetaWebhookMessage): string | null {
  switch (message.type) {
    case "text":
      return message.text?.body ?? null
    case "image":
      return message.image?.caption ?? "[Imagem]"
    case "audio":
      return "[Áudio]"
    case "video":
      return message.video?.caption ?? "[Vídeo]"
    case "document":
      return message.document?.filename ?? "[Documento]"
    case "location":
      return message.location
        ? `[Localização: ${message.location.latitude}, ${message.location.longitude}]`
        : "[Localização]"
    case "sticker":
      return "[Figurinha]"
    case "contacts":
      return "[Contato]"
    default:
      return null
  }
}

/** Extrai media ID de uma mensagem */
export function extractMediaId(message: MetaWebhookMessage): string | null {
  switch (message.type) {
    case "image":
      return message.image?.id ?? null
    case "audio":
      return message.audio?.id ?? null
    case "video":
      return message.video?.id ?? null
    case "document":
      return message.document?.id ?? null
    case "sticker":
      return message.sticker?.id ?? null
    default:
      return null
  }
}

/** Extrai mime_type de uma mensagem */
export function extractMimeType(message: MetaWebhookMessage): string | null {
  switch (message.type) {
    case "image":
      return message.image?.mime_type ?? null
    case "audio":
      return message.audio?.mime_type ?? null
    case "video":
      return message.video?.mime_type ?? null
    case "document":
      return message.document?.mime_type ?? null
    case "sticker":
      return message.sticker?.mime_type ?? null
    default:
      return null
  }
}

// ─── Embedded Signup helpers ─────────────────────────────────────────────────

/**
 * Troca o authorization code do Embedded Signup por um access token de longa duração.
 * Chamado pelo backend após o usuário completar o fluxo OAuth no frontend.
 */
export async function exchangeCodeForToken(code: string): Promise<{
  access_token: string
  token_type: string
  expires_in?: number
}> {
  const appId = process.env.META_APP_ID
  const appSecret = process.env.META_APP_SECRET

  if (!appId || !appSecret) {
    throw new Error("META_APP_ID and META_APP_SECRET must be configured")
  }

  const res = await fetch(
    `${GRAPH_API_BASE}/oauth/access_token?` +
      new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        code,
      }),
    { method: "GET" }
  )

  if (!res.ok) {
    const error = await res.json().catch(() => ({}))
    throw new MetaApiError(
      error.error?.message || "Token exchange failed",
      error.error?.code,
      undefined,
      res.status
    )
  }

  return res.json()
}

/**
 * Troca um token de curta duração por um de longa duração (60 dias).
 */
export async function getLongLivedToken(shortLivedToken: string): Promise<{
  access_token: string
  token_type: string
  expires_in: number
}> {
  const appId = process.env.META_APP_ID
  const appSecret = process.env.META_APP_SECRET

  if (!appId || !appSecret) {
    throw new Error("META_APP_ID and META_APP_SECRET must be configured")
  }

  const res = await fetch(
    `${GRAPH_API_BASE}/oauth/access_token?` +
      new URLSearchParams({
        grant_type: "fb_exchange_token",
        client_id: appId,
        client_secret: appSecret,
        fb_exchange_token: shortLivedToken,
      }),
    { method: "GET" }
  )

  if (!res.ok) {
    const error = await res.json().catch(() => ({}))
    throw new MetaApiError(
      error.error?.message || "Long-lived token exchange failed",
      error.error?.code,
      undefined,
      res.status
    )
  }

  return res.json()
}

/**
 * Registra o número de telefone no WhatsApp Cloud API.
 * Necessário após Embedded Signup para ativar o recebimento de mensagens.
 */
export async function registerPhoneNumber(
  phoneNumberId: string,
  accessToken: string
): Promise<{ success: boolean }> {
  const res = await fetch(`${GRAPH_API_BASE}/${phoneNumberId}/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      pin: "000000", // PIN de 6 dígitos para 2FA — pode ser configurável
    }),
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({}))
    throw new MetaApiError(
      error.error?.message || "Phone registration failed",
      error.error?.code,
      undefined,
      res.status
    )
  }

  return res.json()
}

/**
 * Busca os WABAs e números associados a um token de acesso.
 * Usado após Embedded Signup para descobrir os IDs.
 */
export async function getWabaInfo(accessToken: string): Promise<{
  waba_id: string
  phone_numbers: PhoneNumberInfo[]
}> {
  // Buscar WABAs do business
  const debugRes = await fetch(
    `${GRAPH_API_BASE}/debug_token?input_token=${accessToken}`,
    {
      headers: { Authorization: `Bearer ${process.env.META_APP_ID}|${process.env.META_APP_SECRET}` },
    }
  )

  if (!debugRes.ok) {
    throw new MetaApiError("Failed to debug token", undefined, undefined, debugRes.status)
  }

  const debugData = await debugRes.json()
  const granularScopes = debugData.data?.granular_scopes ?? []
  const wabaScope = granularScopes.find((s: { scope: string }) => s.scope === "whatsapp_business_management")
  const wabaId = wabaScope?.target_ids?.[0]

  if (!wabaId) {
    throw new MetaApiError("No WABA found in token scopes")
  }

  // Buscar números do WABA
  const phonesRes = await fetch(
    `${GRAPH_API_BASE}/${wabaId}/phone_numbers?fields=display_phone_number,verified_name,quality_rating,messaging_limit`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

  if (!phonesRes.ok) {
    throw new MetaApiError("Failed to fetch phone numbers", undefined, undefined, phonesRes.status)
  }

  const phonesData = await phonesRes.json()

  return {
    waba_id: wabaId,
    phone_numbers: phonesData.data ?? [],
  }
}
