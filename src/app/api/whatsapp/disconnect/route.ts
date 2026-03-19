import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { ZApiClient } from "@/lib/zapi"

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: connection } = await supabase
    .from("whatsapp_connections")
    .select("instance_id, instance_token, client_token")
    .single()

  if (!connection) {
    return NextResponse.json(
      { error: "No WhatsApp connection configured" },
      { status: 404 }
    )
  }

  const zapi = new ZApiClient(connection.instance_id, connection.instance_token, connection.client_token)

  try {
    await zapi.disconnect()

    await supabase
      .from("whatsapp_connections")
      .update({
        status: "disconnected",
        disconnected_at: new Date().toISOString(),
      })
      .eq("instance_id", connection.instance_id)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("Z-API disconnect error:", err)
    return NextResponse.json(
      { error: "Failed to disconnect" },
      { status: 502 }
    )
  }
}
