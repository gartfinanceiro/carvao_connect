import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import {
  type MetaWebhookPayload,
  type MetaWebhookMessage,
  type MetaWebhookStatus,
  mapMessageType,
  extractMessageContent,
  extractMimeType,
  normalizePhone,
} from "@/lib/meta-whatsapp"

// Usar service role para operações do webhook (não há sessão de usuário)
function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * GET — Verificação do webhook pela Meta
 * A Meta envia um GET com hub.mode, hub.verify_token e hub.challenge
 * para verificar que o endpoint é válido.
 */
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams
  const mode = searchParams.get("hub.mode")
  const token = searchParams.get("hub.verify_token")
  const challenge = searchParams.get("hub.challenge")

  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN

  if (mode === "subscribe" && token === verifyToken) {
    console.log("[Webhook] Verification successful")
    return new NextResponse(challenge, { status: 200 })
  }

  console.warn("[Webhook] Verification failed:", { mode, token: token?.slice(0, 5) + "..." })
  return NextResponse.json({ error: "Forbidden" }, { status: 403 })
}

/**
 * POST — Recebimento de mensagens e status updates
 * A Meta envia notificações de mensagens recebidas e mudanças de status.
 */
export async function POST(req: NextRequest) {
  // Responder 200 imediatamente — Meta espera resposta rápida (< 5s)
  // Processar em background
  try {
    const body: MetaWebhookPayload = await req.json()

    if (body.object !== "whatsapp_business_account") {
      return NextResponse.json({ error: "Invalid object" }, { status: 400 })
    }

    const supabase = getAdminClient()

    for (const entry of body.entry) {
      for (const change of entry.changes) {
        if (change.field !== "messages") continue

        const { value } = change
        const phoneNumberId = value.metadata.phone_number_id

        // Buscar conexão pelo phone_number_id
        const { data: connection } = await supabase
          .from("whatsapp_connections")
          .select("id, organization_id, meta_access_token")
          .eq("meta_phone_number_id", phoneNumberId)
          .eq("status", "connected")
          .single()

        if (!connection) {
          console.warn("[Webhook] No connection found for phone_number_id:", phoneNumberId)
          continue
        }

        // Processar mensagens recebidas
        if (value.messages) {
          for (const message of value.messages) {
            await processIncomingMessage(supabase, connection, message, value.contacts?.[0])
          }
        }

        // Processar status updates (sent, delivered, read, failed)
        if (value.statuses) {
          for (const status of value.statuses) {
            await processStatusUpdate(supabase, status)
          }
        }
      }
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err) {
    console.error("[Webhook] Error processing:", err)
    // Sempre retornar 200 para evitar que a Meta desabilite o webhook
    return NextResponse.json({ success: true }, { status: 200 })
  }
}

// ─── Processamento de mensagens ──────────────────────────────────────────────

async function processIncomingMessage(
  supabase: ReturnType<typeof getAdminClient>,
  connection: { id: string; organization_id: string; meta_access_token: string | null },
  message: MetaWebhookMessage,
  contact?: { profile: { name: string }; wa_id: string }
) {
  const phone = normalizePhone(message.from)

  // Dedup: verificar se já processamos essa mensagem
  const { data: existing } = await supabase
    .from("whatsapp_messages")
    .select("id")
    .eq("meta_message_id", message.id)
    .single()

  if (existing) return

  // Tentar encontrar fornecedor pelo telefone
  const { data: supplier } = await supabase
    .rpc("find_supplier_by_phone", { p_phone: phone })
    .single<{ id: string }>()

  // Buscar ou criar conversa
  const conversationId = await findOrCreateConversation(
    supabase,
    connection,
    phone,
    supplier?.id ?? null
  )

  // Inserir mensagem
  const messageTimestamp = new Date(parseInt(message.timestamp) * 1000).toISOString()

  await supabase.from("whatsapp_messages").insert({
    organization_id: connection.organization_id,
    connection_id: connection.id,
    conversation_id: conversationId,
    meta_message_id: message.id,
    phone,
    supplier_id: supplier?.id ?? null,
    direction: "inbound",
    message_type: mapMessageType(message.type),
    content: extractMessageContent(message),
    media_mime_type: extractMimeType(message),
    file_name: message.document?.filename ?? null,
    sender_name: contact?.profile?.name ?? null,
    is_group: false,
    status: "received",
    context_message_id: message.context?.id ?? null,
    raw_payload: message as unknown as Record<string, unknown>,
    message_timestamp: messageTimestamp,
  })

  // Atualizar contadores da conversa
  await supabase
    .from("whatsapp_conversations")
    .update({
      last_message_at: messageTimestamp,
      message_count: await getConversationMessageCount(supabase, conversationId),
    })
    .eq("id", conversationId)
}

async function processStatusUpdate(
  supabase: ReturnType<typeof getAdminClient>,
  status: MetaWebhookStatus
) {
  const updateData: Record<string, unknown> = {
    status: status.status,
  }

  if (status.errors?.length) {
    updateData.error_code = String(status.errors[0].code)
    updateData.error_message = status.errors[0].message
  }

  await supabase
    .from("whatsapp_messages")
    .update(updateData)
    .eq("meta_message_id", status.id)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CONVERSATION_GAP_MS = 30 * 60 * 1000 // 30 minutos

async function findOrCreateConversation(
  supabase: ReturnType<typeof getAdminClient>,
  connection: { id: string; organization_id: string },
  phone: string,
  supplierId: string | null
): Promise<string> {
  // Buscar conversa aberta recente (última mensagem < 30 min)
  const cutoff = new Date(Date.now() - CONVERSATION_GAP_MS).toISOString()

  const { data: existing } = await supabase
    .from("whatsapp_conversations")
    .select("id")
    .eq("organization_id", connection.organization_id)
    .eq("connection_id", connection.id)
    .eq("phone", phone)
    .eq("status", "open")
    .gte("last_message_at", cutoff)
    .order("last_message_at", { ascending: false })
    .limit(1)
    .single()

  if (existing) return existing.id

  // Criar nova conversa
  const now = new Date().toISOString()
  const { data: newConversation, error } = await supabase
    .from("whatsapp_conversations")
    .insert({
      organization_id: connection.organization_id,
      connection_id: connection.id,
      supplier_id: supplierId,
      phone,
      started_at: now,
      last_message_at: now,
      message_count: 0,
      inactivity_minutes: 0,
      status: "open",
    })
    .select("id")
    .single()

  if (error || !newConversation) {
    console.error("[Webhook] Failed to create conversation:", error)
    throw new Error("Failed to create conversation")
  }

  return newConversation.id
}

async function getConversationMessageCount(
  supabase: ReturnType<typeof getAdminClient>,
  conversationId: string
): Promise<number> {
  const { count } = await supabase
    .from("whatsapp_messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", conversationId)

  return count ?? 0
}
