import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  exchangeCodeForToken,
  getLongLivedToken,
  getWabaInfo,
  registerPhoneNumber,
} from "@/lib/meta-whatsapp"

/**
 * POST /api/whatsapp/embedded-signup
 *
 * Recebe o resultado do fluxo Embedded Signup do Facebook JS SDK.
 * O frontend envia o authorization code após o usuário completar o OAuth.
 *
 * Body: { code: string, phoneNumberId?: string }
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
    .select("role, organization_id")
    .eq("id", user.id)
    .single()

  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Only admins can configure WhatsApp" }, { status: 403 })
  }

  const body = await req.json()
  const { code } = body as { code: string }

  if (!code) {
    return NextResponse.json({ error: "Authorization code is required" }, { status: 400 })
  }

  try {
    // 1. Trocar code por access token
    const tokenResult = await exchangeCodeForToken(code)

    // 2. Trocar por token de longa duração (60 dias)
    const longLivedToken = await getLongLivedToken(tokenResult.access_token)

    // 3. Buscar WABA ID e números associados
    const wabaInfo = await getWabaInfo(longLivedToken.access_token)

    if (!wabaInfo.phone_numbers.length) {
      return NextResponse.json(
        { error: "Nenhum número de telefone encontrado na conta WhatsApp Business" },
        { status: 400 }
      )
    }

    // 4. Registrar cada número encontrado
    const connections = []

    for (const phone of wabaInfo.phone_numbers) {
      // Registrar o número na Cloud API
      try {
        await registerPhoneNumber(phone.id, longLivedToken.access_token)
      } catch (err) {
        console.warn(`[Embedded Signup] Failed to register phone ${phone.id}:`, err)
        // Continuar mesmo se falhar — pode já estar registrado
      }

      // Verificar se já existe conexão para este phone_number_id
      const { data: existing } = await supabase
        .from("whatsapp_connections")
        .select("id")
        .eq("organization_id", profile.organization_id)
        .eq("meta_phone_number_id", phone.id)
        .single()

      const tokenExpiresAt = new Date(
        Date.now() + (longLivedToken.expires_in ?? 5184000) * 1000
      ).toISOString()

      const connectionData = {
        organization_id: profile.organization_id,
        meta_waba_id: wabaInfo.waba_id,
        meta_phone_number_id: phone.id,
        meta_access_token: longLivedToken.access_token,
        meta_token_expires_at: tokenExpiresAt,
        display_phone_number: phone.display_phone_number,
        verified_name: phone.verified_name,
        quality_rating: phone.quality_rating || "GREEN",
        messaging_limit: phone.messaging_limit ?? null,
        label: phone.verified_name || "Principal",
        webhook_verified: false,
        status: "connected" as const,
        connected_phone: phone.display_phone_number,
        connected_at: new Date().toISOString(),
        disconnected_at: null,
        created_by: user.id,
      }

      if (existing) {
        // Atualizar conexão existente
        const { error } = await supabase
          .from("whatsapp_connections")
          .update(connectionData)
          .eq("id", existing.id)

        if (error) throw error
        connections.push({ ...connectionData, id: existing.id })
      } else {
        // Criar nova conexão
        const { data: newConn, error } = await supabase
          .from("whatsapp_connections")
          .insert(connectionData)
          .select("id")
          .single()

        if (error) throw error
        connections.push({ ...connectionData, id: newConn?.id })
      }
    }

    return NextResponse.json({
      success: true,
      connections: connections.map((c) => ({
        id: c.id,
        phone: c.display_phone_number,
        name: c.verified_name,
        quality: c.quality_rating,
      })),
    })
  } catch (err) {
    console.error("[Embedded Signup] Error:", err)
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json(
      { error: `Erro ao conectar WhatsApp: ${message}` },
      { status: 502 }
    )
  }
}
