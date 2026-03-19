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
    .select("instance_id, instance_token, client_token, status")
    .single()

  if (!connection) {
    return NextResponse.json(
      { error: "No WhatsApp connection configured" },
      { status: 404 }
    )
  }

  const zapi = new ZApiClient(connection.instance_id, connection.instance_token, connection.client_token)

  try {
    const qr = await zapi.getQrCode()

    if (qr.connected) {
      // Already connected — update status if needed
      if (connection.status !== "connected") {
        await supabase
          .from("whatsapp_connections")
          .update({
            status: "connected",
            connected_at: new Date().toISOString(),
          })
          .eq("instance_id", connection.instance_id)
      }
      return NextResponse.json({ connected: true, qrCode: null })
    }

    // Update status to connecting
    if (connection.status !== "connecting") {
      await supabase
        .from("whatsapp_connections")
        .update({ status: "connecting" })
        .eq("instance_id", connection.instance_id)
    }

    return NextResponse.json({ connected: false, qrCode: qr.value })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("Z-API QR code error:", message)
    return NextResponse.json(
      { error: "Failed to get QR code", detail: message },
      { status: 502 }
    )
  }
}
