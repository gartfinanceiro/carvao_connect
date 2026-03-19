import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { ZApiClient } from "@/lib/zapi"

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: connection } = await supabase
    .from("whatsapp_connections")
    .select("instance_id, instance_token, client_token, status, connected_phone, connected_at")
    .single()

  if (!connection) {
    return NextResponse.json({
      configured: false,
      status: "disconnected",
      connectedPhone: null,
      connectedAt: null,
    })
  }

  const zapi = new ZApiClient(connection.instance_id, connection.instance_token, connection.client_token)

  try {
    const zapiStatus = await zapi.getStatus()

    // Sync DB status with Z-API reality
    if (zapiStatus.connected && connection.status !== "connected") {
      await supabase
        .from("whatsapp_connections")
        .update({
          status: "connected",
          connected_at: new Date().toISOString(),
        })
        .eq("instance_id", connection.instance_id)
    } else if (!zapiStatus.connected && connection.status === "connected") {
      await supabase
        .from("whatsapp_connections")
        .update({
          status: "disconnected",
          disconnected_at: new Date().toISOString(),
        })
        .eq("instance_id", connection.instance_id)
    }

    return NextResponse.json({
      configured: true,
      status: zapiStatus.connected ? "connected" : "disconnected",
      connectedPhone: connection.connected_phone,
      connectedAt: connection.connected_at,
    })
  } catch (err) {
    console.error("Z-API status error:", err)
    return NextResponse.json({
      configured: true,
      status: connection.status,
      connectedPhone: connection.connected_phone,
      connectedAt: connection.connected_at,
      zapiError: true,
    })
  }
}
