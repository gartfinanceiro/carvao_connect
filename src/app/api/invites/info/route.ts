import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

// GET — Public route to get invite info by token
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get("token")

    if (!token) {
      return NextResponse.json({ error: "Token é obrigatório." }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data: invite, error } = await supabase
      .from("invites")
      .select("id, email, role, status, expires_at, organization_id, invited_by")
      .eq("token", token)
      .single()

    if (error || !invite) {
      return NextResponse.json({ error: "Convite não encontrado." }, { status: 404 })
    }

    if (invite.status !== "pending") {
      return NextResponse.json({ error: "Este convite já foi utilizado ou revogado." }, { status: 410 })
    }

    if (new Date(invite.expires_at) < new Date()) {
      return NextResponse.json({ error: "Este convite expirou." }, { status: 410 })
    }

    // Get org name
    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", invite.organization_id)
      .single()

    // Get inviter name
    const { data: inviterProfile } = await supabase
      .from("profiles")
      .select("name")
      .eq("id", invite.invited_by)
      .single()

    return NextResponse.json({
      email: invite.email,
      role: invite.role,
      orgName: org?.name || "Organização",
      invitedByName: inviterProfile?.name || "Administrador",
      expiresAt: invite.expires_at,
    })
  } catch (err) {
    console.error("[invites/info] Error:", err)
    return NextResponse.json({ error: "Erro interno." }, { status: 500 })
  }
}
