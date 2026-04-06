import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { MetaWhatsAppClient } from "@/lib/meta-whatsapp"

/**
 * GET /api/whatsapp/status
 *
 * Retorna o status de todas as conexões WhatsApp da organização.
 * Adaptado de Z-API para Meta Cloud API.
 */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: connections } = await supabase
    .from("whatsapp_connections")
    .select(
      "id, meta_phone_number_id, meta_access_token, meta_waba_id, meta_token_expires_at, status, display_phone_number, verified_name, quality_rating, messaging_limit, label, connected_at, disconnected_at, webhook_verified"
    )
    .order("created_at", { ascending: true })

  if (!connections || connections.length === 0) {
    return NextResponse.json({
      configured: false,
      connections: [],
    })
  }

  // Para cada conexão, verificar o status real via Graph API
  const enrichedConnections = await Promise.all(
    connections.map(async (conn) => {
      // Verificar se o token está expirado
      const tokenExpired = conn.meta_token_expires_at
        ? new Date(conn.meta_token_expires_at) < new Date()
        : false

      if (tokenExpired && conn.status === "connected") {
        // Marcar como desconectado se o token expirou
        await supabase
          .from("whatsapp_connections")
          .update({ status: "disconnected", disconnected_at: new Date().toISOString() })
          .eq("id", conn.id)

        return { ...conn, status: "disconnected", tokenExpired: true }
      }

      // Verificar status real via Meta API (somente se conectado)
      if (conn.status === "connected" && conn.meta_access_token && conn.meta_phone_number_id) {
        try {
          const client = new MetaWhatsAppClient(conn.meta_access_token, conn.meta_phone_number_id)
          const phoneInfo = await client.getPhoneNumberInfo()

          // Atualizar quality_rating e messaging_limit se mudaram
          if (
            phoneInfo.quality_rating !== conn.quality_rating ||
            phoneInfo.messaging_limit !== conn.messaging_limit
          ) {
            await supabase
              .from("whatsapp_connections")
              .update({
                quality_rating: phoneInfo.quality_rating,
                messaging_limit: phoneInfo.messaging_limit ?? null,
                verified_name: phoneInfo.verified_name,
              })
              .eq("id", conn.id)
          }

          return {
            ...conn,
            quality_rating: phoneInfo.quality_rating,
            messaging_limit: phoneInfo.messaging_limit ?? conn.messaging_limit,
            verified_name: phoneInfo.verified_name,
          }
        } catch (err) {
          console.error(`[Status] Error checking phone ${conn.meta_phone_number_id}:`, err)
          return { ...conn, apiError: true }
        }
      }

      return conn
    })
  )

  return NextResponse.json({
    configured: true,
    connections: enrichedConnections.map((c) => ({
      id: c.id,
      status: c.status,
      phone: c.display_phone_number,
      verifiedName: c.verified_name,
      qualityRating: c.quality_rating,
      messagingLimit: c.messaging_limit,
      label: c.label,
      connectedAt: c.connected_at,
      disconnectedAt: c.disconnected_at,
      webhookVerified: c.webhook_verified,
      tokenExpired: "tokenExpired" in c ? c.tokenExpired : false,
      apiError: "apiError" in c ? c.apiError : false,
    })),
  })
}
