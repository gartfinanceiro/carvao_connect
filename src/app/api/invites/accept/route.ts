import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

// POST — Accept invite and create account
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { token, name, password } = body as {
      token: string
      name: string
      password: string
    }

    if (!token || !name || !password) {
      return NextResponse.json({ error: "Todos os campos são obrigatórios." }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "A senha deve ter pelo menos 6 caracteres." }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Find invite
    const { data: invite, error: inviteError } = await supabase
      .from("invites")
      .select("*")
      .eq("token", token)
      .eq("status", "pending")
      .single()

    if (inviteError || !invite) {
      return NextResponse.json({ error: "Convite não encontrado ou já utilizado." }, { status: 404 })
    }

    if (new Date(invite.expires_at) < new Date()) {
      await supabase
        .from("invites")
        .update({ status: "expired" })
        .eq("id", invite.id)
      return NextResponse.json({ error: "Este convite expirou." }, { status: 410 })
    }

    // Create user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: invite.email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        organization_id: invite.organization_id,
        role: invite.role,
      },
    })

    if (authError || !authData.user) {
      // If user already exists, try to just add the profile
      if (authError?.message?.includes("already been registered")) {
        return NextResponse.json({ error: "Este email já está cadastrado. Faça login." }, { status: 409 })
      }
      return NextResponse.json({ error: authError?.message || "Erro ao criar conta." }, { status: 500 })
    }

    // Copy permissions from invite to profile (if member with permissions)
    if (invite.role !== "admin" && invite.permissions) {
      await supabase
        .from("profiles")
        .update({
          permissions: invite.permissions,
          profile_template: invite.profile_template,
        })
        .eq("id", authData.user.id)
    }

    // Mark invite as accepted
    await supabase
      .from("invites")
      .update({ status: "accepted", accepted_at: new Date().toISOString() })
      .eq("id", invite.id)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[invites/accept] Error:", err)
    return NextResponse.json({ error: "Erro interno." }, { status: 500 })
  }
}
