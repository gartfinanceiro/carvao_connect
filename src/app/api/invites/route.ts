import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// POST — Create invite
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 })
    }

    // Get caller's profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id, role")
      .eq("id", user.id)
      .single()

    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Apenas administradores podem convidar membros." }, { status: 403 })
    }

    const body = await request.json()
    const { email, role = "member", permissions = null, profileTemplate = null } = body as {
      email: string
      role?: string
      permissions?: Record<string, boolean> | null
      profileTemplate?: string | null
    }

    if (!email) {
      return NextResponse.json({ error: "Email é obrigatório." }, { status: 400 })
    }

    if (role !== "admin" && role !== "member") {
      return NextResponse.json({ error: "Role inválido." }, { status: 400 })
    }

    // Check user limit
    const { data: limitData } = await supabase.rpc("check_plan_limit", { p_resource: "users" })
    const limit = limitData as unknown as { allowed: boolean; max: number } | null
    if (limit && !limit.allowed) {
      return NextResponse.json({ error: `Limite de ${limit.max} usuários atingido.` }, { status: 403 })
    }

    // Check if email is already a member
    const adminClient = createAdminClient()
    const { data: existingUsers } = await adminClient.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    )
    if (existingUser) {
      const { data: existingProfile } = await adminClient
        .from("profiles")
        .select("id")
        .eq("id", existingUser.id)
        .eq("organization_id", profile.organization_id)
        .single()
      if (existingProfile) {
        return NextResponse.json({ error: "Este email já é membro da organização." }, { status: 409 })
      }
    }

    // Check for existing pending invite
    const { data: existingInvite } = await supabase
      .from("invites")
      .select("id, status")
      .eq("organization_id", profile.organization_id)
      .eq("email", email.toLowerCase())
      .eq("status", "pending")
      .single()

    if (existingInvite) {
      return NextResponse.json({ error: "Já existe um convite pendente para este email." }, { status: 409 })
    }

    // Create invite
    const { data: invite, error } = await supabase
      .from("invites")
      .insert({
        organization_id: profile.organization_id,
        email: email.toLowerCase(),
        role,
        permissions: role === "admin" ? null : permissions,
        profile_template: role === "admin" ? null : profileTemplate,
        invited_by: user.id,
      })
      .select("id, token, email, role, expires_at")
      .single()

    if (error) {
      // Unique constraint — might be a revoked/expired invite, delete and retry
      if (error.code === "23505") {
        await supabase
          .from("invites")
          .delete()
          .eq("organization_id", profile.organization_id)
          .eq("email", email.toLowerCase())
          .neq("status", "pending")

        const { data: retryInvite, error: retryError } = await supabase
          .from("invites")
          .insert({
            organization_id: profile.organization_id,
            email: email.toLowerCase(),
            role,
            invited_by: user.id,
          })
          .select("id, token, email, role, expires_at")
          .single()

        if (retryError) {
          return NextResponse.json({ error: "Erro ao criar convite." }, { status: 500 })
        }

        const link = `${process.env.NEXT_PUBLIC_SITE_URL}/convite?token=${retryInvite.token}`
        return NextResponse.json({ invite: retryInvite, link })
      }
      return NextResponse.json({ error: "Erro ao criar convite." }, { status: 500 })
    }

    const link = `${process.env.NEXT_PUBLIC_SITE_URL}/convite?token=${invite.token}`
    return NextResponse.json({ invite, link })
  } catch (err) {
    console.error("[invites] Error:", err)
    return NextResponse.json({ error: "Erro interno." }, { status: 500 })
  }
}

// GET — List invites
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 })
    }

    const { data: invites } = await supabase
      .from("invites")
      .select("*")
      .order("created_at", { ascending: false })

    return NextResponse.json({ invites: invites ?? [] })
  } catch (err) {
    console.error("[invites] Error:", err)
    return NextResponse.json({ error: "Erro interno." }, { status: 500 })
  }
}

// DELETE — Revoke invite
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const inviteId = searchParams.get("id")

    if (!inviteId) {
      return NextResponse.json({ error: "ID do convite é obrigatório." }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Apenas administradores." }, { status: 403 })
    }

    const { error } = await supabase
      .from("invites")
      .update({ status: "revoked" })
      .eq("id", inviteId)

    if (error) {
      return NextResponse.json({ error: "Erro ao revogar convite." }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[invites] Error:", err)
    return NextResponse.json({ error: "Erro interno." }, { status: 500 })
  }
}
