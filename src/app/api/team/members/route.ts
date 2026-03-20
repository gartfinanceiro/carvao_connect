import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// DELETE — Remove team member
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const memberId = searchParams.get("id")

    if (!memberId) {
      return NextResponse.json({ error: "ID do membro é obrigatório." }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 })
    }

    // Can't remove yourself
    if (memberId === user.id) {
      return NextResponse.json({ error: "Você não pode remover a si mesmo." }, { status: 400 })
    }

    // Verify caller is admin
    const { data: callerProfile } = await supabase
      .from("profiles")
      .select("organization_id, role")
      .eq("id", user.id)
      .single()

    if (!callerProfile || callerProfile.role !== "admin") {
      return NextResponse.json({ error: "Apenas administradores." }, { status: 403 })
    }

    // Verify target is in same org
    const adminClient = createAdminClient()
    const { data: targetProfile } = await adminClient
      .from("profiles")
      .select("id, organization_id, role")
      .eq("id", memberId)
      .eq("organization_id", callerProfile.organization_id)
      .single()

    if (!targetProfile) {
      return NextResponse.json({ error: "Membro não encontrado." }, { status: 404 })
    }

    // Check if removing last admin
    if (targetProfile.role === "admin") {
      const { count } = await adminClient
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", callerProfile.organization_id)
        .eq("role", "admin")

      if (count && count <= 1) {
        return NextResponse.json({ error: "Não é possível remover o último administrador." }, { status: 400 })
      }
    }

    // Delete profile first, then auth user
    await adminClient.from("profiles").delete().eq("id", memberId)
    await adminClient.auth.admin.deleteUser(memberId)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[team/members] Error:", err)
    return NextResponse.json({ error: "Erro interno." }, { status: 500 })
  }
}

// PATCH — Change member role and/or permissions
export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { userId, newRole, permissions, profileTemplate } = body as {
      userId: string
      newRole?: string
      permissions?: Record<string, boolean> | null
      profileTemplate?: string | null
    }

    if (!userId) {
      return NextResponse.json({ error: "userId é obrigatório." }, { status: 400 })
    }

    if (newRole && newRole !== "admin" && newRole !== "member") {
      return NextResponse.json({ error: "Role inválido." }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 })
    }

    // Verify caller is admin
    const { data: callerProfile } = await supabase
      .from("profiles")
      .select("organization_id, role")
      .eq("id", user.id)
      .single()

    if (!callerProfile || callerProfile.role !== "admin") {
      return NextResponse.json({ error: "Apenas administradores." }, { status: 403 })
    }

    const adminClient = createAdminClient()

    // Verify target is in same org
    const { data: targetProfile } = await adminClient
      .from("profiles")
      .select("id, organization_id, role")
      .eq("id", userId)
      .eq("organization_id", callerProfile.organization_id)
      .single()

    if (!targetProfile) {
      return NextResponse.json({ error: "Membro não encontrado." }, { status: 404 })
    }

    // Check if demoting last admin
    const effectiveRole = newRole ?? targetProfile.role
    if (targetProfile.role === "admin" && effectiveRole === "member") {
      const { count } = await adminClient
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", callerProfile.organization_id)
        .eq("role", "admin")

      if (count && count <= 1) {
        return NextResponse.json({ error: "Não é possível rebaixar o último administrador." }, { status: 400 })
      }
    }

    // Build update payload
    const updateData: Record<string, unknown> = {}
    if (newRole) updateData.role = newRole
    if (permissions !== undefined) updateData.permissions = permissions
    if (profileTemplate !== undefined) updateData.profile_template = profileTemplate

    // Admin → clear permissions (admin always has full access)
    if (effectiveRole === "admin") {
      updateData.permissions = null
      updateData.profile_template = null
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "Nenhum campo para atualizar." }, { status: 400 })
    }

    const { error } = await adminClient
      .from("profiles")
      .update(updateData)
      .eq("id", userId)

    if (error) {
      return NextResponse.json({ error: "Erro ao atualizar membro." }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[team/members] Error:", err)
    return NextResponse.json({ error: "Erro interno." }, { status: 500 })
  }
}
