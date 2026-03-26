"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Loader2, LogOut, MessageSquare, RefreshCw, CreditCard, ExternalLink, Lock,
  Users, UserPlus, Copy, Check, MoreHorizontal, Shield, ShieldOff, UserMinus, Settings,
  Bell, Calculator, User, Building2, ChevronRight,
} from "lucide-react"
import { toast } from "sonner"
import { WhatsAppSetup } from "@/components/whatsapp-setup"
import { DiscountPolicySettings } from "@/components/discount-policy-settings"
import { useSubscription } from "@/components/subscription-provider"
import {
  PROFILE_TEMPLATES,
  MODULE_LABELS,
  MODULES,
  type Permissions,
  type ProfileTemplate,
  type ModuleKey,
} from "@/lib/permissions"

interface ConfiguracoesClientProps {
  userName: string
  userEmail: string
  orgName: string
}

const planLabels: Record<string, string> = {
  trial: "Trial",
  starter: "Starter",
  professional: "Professional",
  enterprise: "Enterprise",
  canceled: "Cancelado",
}

const statusLabels: Record<string, { label: string; color: string }> = {
  trialing: { label: "Em teste", color: "bg-blue-100 text-blue-700" },
  active: { label: "Ativo", color: "bg-emerald-100 text-emerald-700" },
  past_due: { label: "Pagamento pendente", color: "bg-amber-100 text-amber-700" },
  canceled: { label: "Cancelado", color: "bg-red-100 text-red-700" },
  unpaid: { label: "Não pago", color: "bg-red-100 text-red-700" },
}

export function ConfiguracoesClient({
  userName,
  userEmail,
  orgName,
}: ConfiguracoesClientProps) {
  const router = useRouter()
  const { subscription, isAdmin } = useSubscription()
  const [name, setName] = useState(userName)
  const [savingName, setSavingName] = useState(false)
  const [refreshingAlerts, setRefreshingAlerts] = useState(false)
  const [loadingPortal, setLoadingPortal] = useState(false)

  // Team state
  interface TeamMember {
    id: string
    name: string
    role: string
    email?: string
    permissions: Permissions | null
    profile_template: ProfileTemplate | null
  }
  interface InviteItem {
    id: string
    email: string
    role: string
    status: string
    token: string
    created_at: string
  }

  const [members, setMembers] = useState<TeamMember[]>([])
  const [invites, setInvites] = useState<InviteItem[]>([])
  const [teamLoading, setTeamLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState("member")
  const [inviteLink, setInviteLink] = useState("")
  const [inviteLoading, setInviteLoading] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [supplierCount, setSupplierCount] = useState<number | null>(null)

  // Permissions modal state
  const [permModalOpen, setPermModalOpen] = useState(false)
  const [permMember, setPermMember] = useState<TeamMember | null>(null)
  const [permTemplate, setPermTemplate] = useState<ProfileTemplate | "custom">("completo")
  const [permModules, setPermModules] = useState<Permissions>({ ...PROFILE_TEMPLATES.completo.permissions })
  const [permSaving, setPermSaving] = useState(false)

  // Invite profile state
  const [inviteTemplate, setInviteTemplate] = useState<ProfileTemplate>("completo")

  // Organization details state
  const [orgDoc, setOrgDoc] = useState("")
  const [orgAddress, setOrgAddress] = useState("")
  const [orgCity, setOrgCity] = useState("")
  const [orgState, setOrgState] = useState("")
  const [orgPhone, setOrgPhone] = useState("")
  const [orgStateReg, setOrgStateReg] = useState("")
  const [savingOrg, setSavingOrg] = useState(false)
  const [orgLoaded, setOrgLoaded] = useState(false)

  const fetchOrgDetails = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase.from("profiles").select("organization_id").eq("id", user.id).single()
    if (!profile?.organization_id) return
    const { data: org } = await supabase
      .from("organizations")
      .select("document, address, city, state, phone, state_registration")
      .eq("id", profile.organization_id)
      .single()
    if (org) {
      setOrgDoc(org.document || "")
      setOrgAddress(org.address || "")
      setOrgCity(org.city || "")
      setOrgState(org.state || "")
      setOrgPhone(org.phone || "")
      setOrgStateReg(org.state_registration || "")
    }
    setOrgLoaded(true)
  }, [])

  useEffect(() => { fetchOrgDetails() }, [fetchOrgDetails])

  async function handleSaveOrgDetails() {
    setSavingOrg(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { toast.error("Sessão expirada."); setSavingOrg(false); return }
    const { data: profile } = await supabase.from("profiles").select("organization_id").eq("id", user.id).single()
    if (!profile?.organization_id) { toast.error("Organização não encontrada."); setSavingOrg(false); return }

    const { error } = await supabase.from("organizations").update({
      document: orgDoc.trim() || null,
      address: orgAddress.trim() || null,
      city: orgCity.trim() || null,
      state: orgState.trim() || null,
      phone: orgPhone.trim() || null,
      state_registration: orgStateReg.trim() || null,
    }).eq("id", profile.organization_id)

    if (error) {
      toast.error("Erro ao salvar dados da organização.")
    } else {
      toast.success("Dados da organização atualizados!")
    }
    setSavingOrg(false)
  }

  async function handleSaveName() {
    if (!name.trim()) return
    setSavingName(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      toast.error("Sessão expirada.")
      setSavingName(false)
      return
    }
    const { error } = await supabase
      .from("profiles")
      .update({ name: name.trim() })
      .eq("id", user.id)

    if (error) {
      toast.error("Erro ao salvar nome.")
    } else {
      toast.success("Nome atualizado!")
      router.refresh()
    }
    setSavingName(false)
  }

  async function handleRefreshAlerts() {
    setRefreshingAlerts(true)
    const supabase = createClient()
    const { error } = await supabase.rpc("refresh_daily_alerts")
    if (error) {
      toast.error("Erro ao atualizar alertas.")
    } else {
      toast.success("Alertas atualizados!")
    }
    setRefreshingAlerts(false)
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
  }

  async function handleOpenPortal() {
    setLoadingPortal(true)
    try {
      const res = await fetch("/api/portal", { method: "POST" })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        toast.error(data.error || "Erro ao abrir portal.")
      }
    } catch {
      toast.error("Erro de conexão.")
    }
    setLoadingPortal(false)
  }

  // Fetch team data
  const fetchTeam = useCallback(async () => {
    setTeamLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUserId(user?.id ?? null)

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, name, role, permissions, profile_template")
      .order("created_at", { ascending: true })

    setMembers((profiles as TeamMember[]) ?? [])

    // Fetch active supplier count
    const { count: activeSuppliers } = await supabase
      .from("suppliers")
      .select("id", { count: "exact", head: true })
      .eq("status", "ativo")
    setSupplierCount(activeSuppliers ?? 0)

    // Fetch invites via API
    const res = await fetch("/api/invites")
    const invData = await res.json()
    setInvites(
      (invData.invites ?? []).filter((i: InviteItem) => i.status === "pending")
    )
    setTeamLoading(false)
  }, [])

  useEffect(() => {
    fetchTeam()
  }, [fetchTeam])

  async function handleInvite() {
    if (!inviteEmail.trim()) return
    setInviteLoading(true)
    setInviteLink("")

    try {
      const res = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail.toLowerCase(),
          role: inviteRole,
          permissions: inviteRole === "member" ? PROFILE_TEMPLATES[inviteTemplate as Exclude<ProfileTemplate, "custom">]?.permissions ?? null : null,
          profileTemplate: inviteRole === "member" ? inviteTemplate : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Erro ao criar convite.")
      } else {
        setInviteLink(data.link)
        toast.success("Convite criado! Copie o link.")
        setInviteEmail("")
        fetchTeam()
      }
    } catch {
      toast.error("Erro de conexão.")
    }
    setInviteLoading(false)
  }

  async function handleCopyLink(link: string) {
    await navigator.clipboard.writeText(link)
    setCopiedLink(true)
    toast.success("Link copiado!")
    setTimeout(() => setCopiedLink(false), 2000)
  }

  async function handleRevokeInvite(inviteId: string) {
    const res = await fetch(`/api/invites?id=${inviteId}`, { method: "DELETE" })
    if (res.ok) {
      toast.success("Convite revogado")
      fetchTeam()
    } else {
      toast.error("Erro ao revogar convite.")
    }
  }

  async function handleChangeRole(userId: string, newRole: string) {
    const res = await fetch("/api/team/members", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, newRole }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || "Erro ao alterar role.")
    } else {
      toast.success("Função atualizada")
      fetchTeam()
    }
  }

  function openPermModal(member: TeamMember) {
    setPermMember(member)
    const template = member.profile_template as ProfileTemplate | null
    if (template && template !== "custom" && PROFILE_TEMPLATES[template]) {
      setPermTemplate(template)
      setPermModules({ ...PROFILE_TEMPLATES[template].permissions })
    } else if (member.permissions) {
      setPermTemplate("custom")
      setPermModules({ ...member.permissions })
    } else {
      setPermTemplate("completo")
      setPermModules({ ...PROFILE_TEMPLATES.completo.permissions })
    }
    setPermModalOpen(true)
  }

  function handleTemplateChange(template: ProfileTemplate | "custom") {
    setPermTemplate(template)
    if (template !== "custom" && PROFILE_TEMPLATES[template]) {
      setPermModules({ ...PROFILE_TEMPLATES[template].permissions })
    }
  }

  function handleModuleToggle(module: ModuleKey) {
    setPermTemplate("custom")
    setPermModules((prev) => ({ ...prev, [module]: !prev[module] }))
  }

  async function handleSavePermissions() {
    if (!permMember) return
    setPermSaving(true)
    try {
      const res = await fetch("/api/team/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: permMember.id,
          permissions: permModules,
          profileTemplate: permTemplate,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Erro ao salvar permissões.")
      } else {
        toast.success("Permissões atualizadas")
        setPermModalOpen(false)
        fetchTeam()
      }
    } catch {
      toast.error("Erro de conexão.")
    }
    setPermSaving(false)
  }

  async function handleRemoveMember(userId: string, memberName: string) {
    if (!confirm(`Remover ${memberName} da equipe? Ele perderá acesso ao sistema.`)) return

    const res = await fetch(`/api/team/members?id=${userId}`, { method: "DELETE" })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || "Erro ao remover membro.")
    } else {
      toast.success("Membro removido")
      fetchTeam()
    }
  }

  const plan = subscription?.plan || "trial"
  const subStatus = subscription?.subscription_status || "trialing"
  const limits = subscription?.plan_limits
  const statusInfo = statusLabels[subStatus] || statusLabels.trialing
  const whatsappEnabled = subscription?.plan_limits?.whatsapp_enabled ?? false

  return (
    <div className="p-4 md:p-6 max-w-2xl space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>

      {/* Account Card */}
      <div className="rounded-xl border border-border bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border/60">
          <div className="h-8 w-8 rounded-lg bg-[#1B4332]/10 flex items-center justify-center flex-shrink-0">
            <User className="h-4 w-4 text-[#1B4332]" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Minha conta</h2>
            <p className="text-xs text-muted-foreground">Dados pessoais e acesso</p>
          </div>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-xs text-muted-foreground">Nome</Label>
            <div className="flex gap-2">
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs active:scale-[0.98]"
                onClick={handleSaveName}
                disabled={savingName || name.trim() === userName}
              >
                {savingName && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Email</Label>
            <Input value={userEmail} disabled />
          </div>
        </div>
      </div>

      {/* Organization & Billing Card */}
      <div className="rounded-xl border border-border bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border/60">
          <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
            <Building2 className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Organização e Plano</h2>
            <p className="text-xs text-muted-foreground">Informações da empresa e assinatura</p>
          </div>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <p className="text-sm font-medium">{orgName || "Organização"}</p>
            <p className="text-xs text-muted-foreground">Nome da organização</p>
          </div>

          <div className="flex items-center gap-3">
            <div>
              <p className="text-sm font-medium">
                Plano: {planLabels[plan] || plan}
              </p>
              <span className={`text-[11px] font-semibold rounded-full px-2 py-0.5 inline-block mt-1 ${statusInfo.color}`}>
                {statusInfo.label}
              </span>
            </div>
          </div>

          {/* Usage */}
          {limits && (
            <div className="bg-[#F9F9F9] rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Uso do plano</p>
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-[13px]">
                    <span className="text-[#333]">Fornecedores</span>
                    <span className="text-muted-foreground font-medium">
                      {supplierCount ?? "—"} / {limits.max_suppliers}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[13px]">
                    <span className="text-[#333]">Usuários</span>
                    <span className="text-muted-foreground font-medium">
                      {members.length} / {limits.max_users}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[13px]">
                    <span className="text-[#333]">WhatsApp + IA</span>
                    <span className={`font-medium ${limits.whatsapp_enabled ? "text-emerald-600" : "text-[#999]"}`}>
                      {limits.whatsapp_enabled ? "Incluído" : "Não incluído"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Actions (admin only) */}
          {isAdmin && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/planos")}
                className="text-xs"
              >
                Ver planos
              </Button>
              {subscription?.has_stripe && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOpenPortal}
                  disabled={loadingPortal}
                  className="text-xs"
                >
                  {loadingPortal ? (
                    <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                  ) : (
                    <ExternalLink className="mr-1.5 h-3 w-3" />
                  )}
                  Gerenciar assinatura
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Organization Details Card (admin only) */}
      {isAdmin && orgLoaded && (
        <div className="rounded-xl border border-border bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-border/60">
            <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
              <Building2 className="h-4 w-4 text-slate-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Dados da Empresa</h2>
              <p className="text-xs text-muted-foreground">CNPJ, endereço e dados para o ticket de descarga</p>
            </div>
          </div>
          <div className="px-5 py-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">CNPJ</Label>
                <Input value={orgDoc} onChange={(e) => setOrgDoc(e.target.value)} placeholder="00.000.000/0000-00" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Inscrição Estadual</Label>
                <Input value={orgStateReg} onChange={(e) => setOrgStateReg(e.target.value)} placeholder="ex: 123.456.789.0012" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Endereço</Label>
              <Input value={orgAddress} onChange={(e) => setOrgAddress(e.target.value)} placeholder="Rua, número, bairro" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Cidade</Label>
                <Input value={orgCity} onChange={(e) => setOrgCity(e.target.value)} placeholder="ex: Sete Lagoas" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Estado</Label>
                <Input value={orgState} onChange={(e) => setOrgState(e.target.value)} placeholder="ex: MG" maxLength={2} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Telefone</Label>
                <Input value={orgPhone} onChange={(e) => setOrgPhone(e.target.value)} placeholder="(31) 3333-3333" />
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={handleSaveOrgDetails}
                disabled={savingOrg}
              >
                {savingOrg && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar dados da empresa
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Team Card */}
      <div className="rounded-xl border border-border bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border/60">
          <div className="h-8 w-8 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
            <Users className="h-4 w-4 text-purple-600" />
          </div>
          <div className="flex items-center gap-2">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Equipe</h2>
              <p className="text-xs text-muted-foreground">Membros e permissões de acesso</p>
            </div>
            {limits && (
              <span className="text-[11px] font-medium text-muted-foreground bg-muted rounded-full px-2 py-0.5 ml-1">
                {members.length}/{limits.max_users}
              </span>
            )}
          </div>
        </div>
        <div className="px-5 py-4 space-y-4">
          {/* Roles explanation */}
          <div className="bg-[#F9F9F9] rounded-xl p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="h-7 w-7 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Shield className="h-3.5 w-3.5 text-purple-600" />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-[#333]">Admin</p>
                <p className="text-[12px] text-muted-foreground leading-relaxed">
                  Acesso total: gerenciar equipe, convidar e remover membros, alterar funções, gerenciar assinatura e billing, arquivar/reativar fornecedores e configurar integração WhatsApp.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-[#333]">Membro</p>
                <p className="text-[12px] text-muted-foreground leading-relaxed">
                  Acesso operacional: cadastrar e editar fornecedores, registrar interações e descargas, usar dashboard e alertas. Não pode arquivar fornecedores, gerenciar equipe, billing ou WhatsApp.
                </p>
              </div>
            </div>
          </div>

          {teamLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Member list */}
              <div className="space-y-2">
                {members.map((member) => (
                  <div key={member.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-muted-foreground">
                          {member.name?.[0]?.toUpperCase() || "?"}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{member.name || "Sem nome"}</p>
                          {member.id === currentUserId && (
                            <span className="text-[10px] font-semibold bg-muted text-muted-foreground rounded px-1.5 py-0.5">Você</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[11px] font-semibold rounded-full px-2 py-0.5 inline-block ${
                            member.role === "admin" ? "bg-purple-100 text-purple-700" : "bg-muted text-muted-foreground"
                          }`}>
                            {member.role === "admin" ? "Admin" : "Membro"}
                          </span>
                          {member.role === "member" && member.profile_template && (
                            <span className="text-[11px] font-medium text-muted-foreground bg-muted/50 rounded-full px-2 py-0.5">
                              {member.profile_template === "custom"
                                ? "Personalizado"
                                : PROFILE_TEMPLATES[member.profile_template as Exclude<ProfileTemplate, "custom">]?.label ?? member.profile_template}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {isAdmin && member.id !== currentUserId && (
                      <div className="flex items-center gap-1">
                        {member.role === "member" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-muted-foreground"
                            onClick={() => openPermModal(member)}
                            title="Gerenciar permissões"
                          >
                            <Settings className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-muted-foreground"
                          onClick={() => handleChangeRole(member.id, member.role === "admin" ? "member" : "admin")}
                          title={member.role === "admin" ? "Tornar membro" : "Tornar admin"}
                        >
                          {member.role === "admin" ? (
                            <ShieldOff className="h-3.5 w-3.5" />
                          ) : (
                            <Shield className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-red-500 hover:text-red-600 hover:bg-red-50"
                          onClick={() => handleRemoveMember(member.id, member.name)}
                        >
                          <UserMinus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Pending invites */}
              {invites.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Convites pendentes</p>
                  <div className="space-y-2">
                    {invites.map((invite) => (
                      <div key={invite.id} className="flex items-center justify-between rounded-lg border border-dashed border-border px-3 py-2.5">
                        <div className="min-w-0">
                          <p className="text-sm text-muted-foreground truncate">{invite.email}</p>
                          <span className="text-[11px] text-muted-foreground">
                            {invite.role === "admin" ? "Admin" : "Membro"}
                          </span>
                        </div>
                        {isAdmin && (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-muted-foreground"
                              onClick={() => handleCopyLink(`${window.location.origin}/convite?token=${invite.token}`)}
                            >
                              <Copy className="h-3 w-3 mr-1" />
                              Copiar link
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-red-500 hover:text-red-600 hover:bg-red-50"
                              onClick={() => handleRevokeInvite(invite.id)}
                            >
                              Revogar
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Invite form (admin only) */}
              {isAdmin && (
                <div className="bg-[#F9F9F9] rounded-xl p-4 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Convidar membro</p>
                  <p className="text-[12px] text-muted-foreground leading-relaxed">
                    {inviteRole === "admin"
                      ? "Admin — acesso total: gerenciar equipe, billing, arquivar fornecedores e configurar WhatsApp."
                      : `Membro — perfil ${PROFILE_TEMPLATES[inviteTemplate as Exclude<ProfileTemplate, "custom">]?.label ?? inviteTemplate}: ${PROFILE_TEMPLATES[inviteTemplate as Exclude<ProfileTemplate, "custom">]?.description ?? ""}`}
                  </p>
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      placeholder="Email do colega"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="flex-1"
                    />
                    <select
                      value={inviteRole}
                      onChange={(e) => {
                        setInviteRole(e.target.value)
                        if (e.target.value === "admin") setInviteTemplate("completo")
                      }}
                      className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="member">Membro</option>
                      <option value="admin">Admin</option>
                    </select>
                    {inviteRole === "member" && (
                      <select
                        value={inviteTemplate}
                        onChange={(e) => setInviteTemplate(e.target.value as ProfileTemplate)}
                        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                      >
                        {Object.entries(PROFILE_TEMPLATES).map(([key, tmpl]) => (
                          <option key={key} value={key}>{tmpl.label}</option>
                        ))}
                      </select>
                    )}
                    <Button
                      size="sm"
                      className="bg-[#1B4332] hover:bg-[#2D6A4F] text-xs"
                      onClick={handleInvite}
                      disabled={inviteLoading || !inviteEmail.trim()}
                    >
                      {inviteLoading ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <UserPlus className="h-3 w-3 mr-1" />
                      )}
                      Convidar
                    </Button>
                  </div>
                  {inviteLink && (
                    <div className="flex items-center gap-2 bg-white rounded-lg border border-border p-2">
                      <Input
                        value={inviteLink}
                        readOnly
                        className="text-xs h-7 border-0 bg-transparent"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs flex-shrink-0"
                        onClick={() => handleCopyLink(inviteLink)}
                      >
                        {copiedLink ? (
                          <Check className="h-3 w-3 text-emerald-600" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* WhatsApp Card */}
      <div className="rounded-xl border border-border bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border/60">
          <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
            <MessageSquare className="h-4 w-4 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">WhatsApp</h2>
            <p className="text-xs text-muted-foreground">Integração com WhatsApp + IA</p>
          </div>
        </div>
        <div className="px-5 py-4">
          {whatsappEnabled && isAdmin ? (
            <WhatsAppSetup />
          ) : whatsappEnabled && !isAdmin ? (
            <div className="bg-[#F9F9F9] rounded-xl p-4 flex items-center gap-3">
              <MessageSquare className="h-5 w-5 text-emerald-600" />
              <div>
                <p className="text-sm font-medium text-[#333]">WhatsApp ativo</p>
                <p className="text-xs text-muted-foreground">
                  A configuração do WhatsApp é gerenciada pelo administrador.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-[#F9F9F9] rounded-xl p-4 flex items-center gap-3">
              <Lock className="h-5 w-5 text-[#999]" />
              <div>
                <p className="text-sm font-medium text-[#333]">Disponível no Professional</p>
                <p className="text-xs text-muted-foreground">
                  Faça upgrade para integrar WhatsApp com IA.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/planos")}
                className="ml-auto text-xs"
              >
                Ver planos
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Discount Policy Card */}
      {isAdmin && (
        <div className="rounded-xl border border-border bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-border/60">
            <div className="h-8 w-8 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
              <Calculator className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Tabela de Preços e Descontos</h2>
              <p className="text-xs text-muted-foreground">Faixas de preço por densidade, descontos e regras comerciais</p>
            </div>
          </div>
          <div className="px-5 py-4">
            <DiscountPolicySettings />
          </div>
        </div>
      )}

      {/* Alerts Card */}
      <div className="rounded-xl border border-border bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border/60">
          <div className="h-8 w-8 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
            <Bell className="h-4 w-4 text-orange-600" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Alertas</h2>
            <p className="text-xs text-muted-foreground">Lembretes de vencimentos e inatividade</p>
          </div>
        </div>
        <div className="px-5 py-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Alertas de vencimento de documentos e fornecedores inativos são verificados diariamente.
          </p>
          <Button
            variant="outline"
            onClick={handleRefreshAlerts}
            disabled={refreshingAlerts}
            className="active:scale-[0.98]"
          >
            {refreshingAlerts ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Atualizar alertas
          </Button>
        </div>
      </div>

      {/* Logout Card */}
      <div className="rounded-xl border border-border bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="px-5 py-4">
          <Button variant="ghost" onClick={handleLogout} className="text-muted-foreground hover:text-foreground">
            <LogOut className="mr-2 h-4 w-4" />
            Sair da conta
          </Button>
        </div>
      </div>

      {/* Permissions Modal */}
      {permModalOpen && permMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setPermModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 space-y-5">
              <div>
                <h3 className="text-lg font-semibold">Permissões de {permMember.name}</h3>
                <p className="text-xs text-muted-foreground mt-1">Escolha um perfil ou personalize os módulos</p>
              </div>

              {/* Template selector */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Perfil</p>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.entries(PROFILE_TEMPLATES) as [Exclude<ProfileTemplate, "custom">, typeof PROFILE_TEMPLATES[keyof typeof PROFILE_TEMPLATES]][]).map(([key, tmpl]) => (
                    <button
                      key={key}
                      onClick={() => handleTemplateChange(key)}
                      className={`text-left rounded-lg border p-3 transition-colors ${
                        permTemplate === key
                          ? "border-[#1B4332] bg-[#1B4332]/5"
                          : "border-border hover:border-border/80"
                      }`}
                    >
                      <p className="text-sm font-medium">{tmpl.label}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{tmpl.description}</p>
                    </button>
                  ))}
                  <button
                    onClick={() => handleTemplateChange("custom")}
                    className={`text-left rounded-lg border p-3 transition-colors ${
                      permTemplate === "custom"
                        ? "border-[#1B4332] bg-[#1B4332]/5"
                        : "border-border hover:border-border/80"
                    }`}
                  >
                    <p className="text-sm font-medium">Personalizado</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">Escolha módulo a módulo</p>
                  </button>
                </div>
              </div>

              {/* Module toggles */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Módulos</p>
                <div className="space-y-1">
                  {MODULES.filter((m) => m !== "configuracoes").map((mod) => (
                    <div
                      key={mod}
                      className="flex items-center justify-between rounded-lg px-3 py-2.5 hover:bg-muted/30 transition-colors"
                    >
                      <div>
                        <p className="text-sm font-medium">{MODULE_LABELS[mod].label}</p>
                        <p className="text-[11px] text-muted-foreground">{MODULE_LABELS[mod].description}</p>
                      </div>
                      <button
                        onClick={() => handleModuleToggle(mod)}
                        className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${
                          permModules[mod] ? "bg-[#1B4332]" : "bg-gray-200"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 mt-0.5 ${
                            permModules[mod] ? "translate-x-4 ml-0.5" : "translate-x-0.5"
                          }`}
                        />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2 border-t border-black/[0.04]">
                <Button variant="outline" size="sm" onClick={() => setPermModalOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  className="bg-[#1B4332] hover:bg-[#2D6A4F]"
                  onClick={handleSavePermissions}
                  disabled={permSaving}
                >
                  {permSaving && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
                  Salvar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}