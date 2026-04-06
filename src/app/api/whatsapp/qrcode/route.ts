import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getLongLivedToken, getWabaInfo, registerPhoneNumber } from "@/lib/meta-whatsapp"

/**
 * POST /api/whatsapp/qrcode → /api/whatsapp/reconnect
 *
 * Rota mantida no path /qrcode por retrocompatibilidade,
 * mas agora funciona como reconexão via refresh de token.
 *
 * Na Meta Cloud API não há QR code — a conexão é feita via Embedded Signup.
 * Esta rota permite reconectar uma conexão existente com um novo token.
 *
 * Body: { connectionId: string, code: string }
 */
export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const { connectionId, code } = body as { connectionId?: string; code?: string }

  if (!connectionId || !code) {
    return NextResponse.json(
      { error: "connectionId and code are required" },
      { status: 400 }
    )
  }

  try {
    // Buscar conexão existente
    const { data: connection } = await supabase
      .from("whatsapp_connections")
      .select("id, meta_phone_number_id, meta_waba_id")
      .eq("id", connectionId)
      .single()

    if (!connection) {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 })
    }

    // Trocar novo code por token
    const { access_token } = await getLongLivedToken(code)

    // Verificar que o token ainda tem acesso ao mesmo WABA/número
    const wabaInfo = await getWabaInfo(access_token)
    const matchingPhone = wabaInfo.phone_numbers.find(
      (p: { id: string }) => p.id === connection.meta_phone_number_id
    )

    if (!matchingPhone) {
      return NextResponse.json(
        { error: "O token não tem acesso ao número original. Use o Embedded Signup para reconectar." },
        { status: 400 }
      )
    }

    // Re-registrar número
    try {
      await registerPhoneNumber(matchingPhone.id, access_token)
    } catch {
      // Pode já estar registrado
    }

    // Atualizar conexão
    const tokenExpiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString() // 60 dias

    await supabase
      .from("whatsapp_connections")
      .update({
        meta_access_token: access_token,
        meta_token_expires_at: tokenExpiresAt,
        status: "connected",
        connected_at: new Date().toISOString(),
        disconnected_at: null,
        quality_rating: matchingPhone.quality_rating || "GREEN",
        messaging_limit: matchingPhone.messaging_limit ?? null,
      })
      .eq("id", connectionId)

    return NextResponse.json({
      connected: true,
      phone: matchingPhone.display_phone_number,
      verifiedName: matchingPhone.verified_name,
    })
  } catch (err) {
    console.error("[Reconnect] Error:", err)
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json(
      { error: `Failed to reconnect: ${message}` },
      { status: 502 }
    )
  }
}

/**
 * GET /api/whatsapp/qrcode
 *
 * Mantido para retrocompatibilidade. Retorna que QR code não é mais usado.
 */
export async function GET() {
  return NextResponse.json({
    connected: false,
    qrCode: null,
    message: "QR code não é mais utilizado. Use o Embedded Signup para conectar o WhatsApp.",
    useEmbeddedSignup: true,
  })
}
