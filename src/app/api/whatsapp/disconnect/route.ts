import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * POST /api/whatsapp/disconnect
 *
 * Desconecta um número WhatsApp da organização.
 * Na Meta Cloud API, "desconectar" significa revogar o token e marcar como inativo.
 * O número pode ser reconectado via Embedded Signup.
 *
 * Body: { connectionId: string }
 */
export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Verificar se é admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Only admins can disconnect WhatsApp" }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const { connectionId } = body as { connectionId?: string }

  // Se não informar connectionId, desconectar a primeira conexão (retrocompatibilidade)
  let targetId = connectionId

  if (!targetId) {
    const { data: firstConn } = await supabase
      .from("whatsapp_connections")
      .select("id")
      .eq("status", "connected")
      .order("created_at", { ascending: true })
      .limit(1)
      .single()

    if (!firstConn) {
      return NextResponse.json(
        { error: "No active WhatsApp connection found" },
        { status: 404 }
      )
    }
    targetId = firstConn.id
  }

  try {
    // Na Meta API não há uma chamada de "disconnect" — o número continua
    // registrado na WABA. O que fazemos é invalidar o token localmente
    // e marcar como desconectado. Para remover completamente, seria
    // necessário remover o número via Graph API ou Meta Business Manager.

    const { error } = await supabase
      .from("whatsapp_connections")
      .update({
        status: "disconnected",
        disconnected_at: new Date().toISOString(),
        meta_access_token: null, // Revogar token localmente
      })
      .eq("id", targetId)

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[Disconnect] Error:", err)
    return NextResponse.json(
      { error: "Failed to disconnect" },
      { status: 502 }
    )
  }
}
