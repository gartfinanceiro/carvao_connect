"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Loader2, LogOut, MessageSquare, RefreshCw, CreditCard, ExternalLink, Lock,
  Users, UserPlus, Copy, Check, MoreHorizontal, Shield, ShieldOff, UserMinus,
} from "lucide-react"
import { toast } from "sonner"
import { WhatsAppSetup } from "@/components/whatsapp-setup"
import { useSubscription } from "@/components/subscription-provider"

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
      .select("id, name, role")
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
        body: JSON.stringify({ email: inviteEmail.toLowerCase(), role: inviteRole }),
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
    <div className="p-4 md:p-6 max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>

      {/* Account */}
      <section className="mt-8">
        <h2 className="text-sm font-medium text-foreground">Minha conta</h2>
        <div className="mt-4 space-y-4">
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
      </section>

      <div className="border-t border-black/[0.04] my-8" />

      {/* Organization & Billing */}
      <section>
        <h2 className="text-sm font-medium text-foreground flex items-center gap-2">
          <CreditCard className="h-4 w-4" />
          Organização e Plano
        </h2>
        <div className="mt-4 space-y-4">
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
      </section>

      <div className="border-t border-black/[0.04] my-8" />

      {/* Team */}
      <section>
        <h2 className="text-sm font-medium text-foreground flex items-center gap-2">
          <Users className="h-4 w-4" />
          Equipe
          {limits && (
            <span className="text-xs font-normal text-muted-foreground">
              · {members.length}/{limits.max_users} usuários
            </span>
          )}
        </h2>
        <div className="mt-4 space-y-4">
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
                        <span className={`text-[11px] font-semibold rounded-full px-2 py-0.5 inline-block ${
                          member.role === "admin" ? "bg-purple-100 text-purple-700" : "bg-muted text-muted-foreground"
                        }`}>
                          {member.role === "admin" ? "Admin" : "Membro"}
                        </span>
                      </div>
                    </div>
                    {isAdmin && member.id !== currentUserId && (
                      <div className="flex items-center gap-1">
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
                      : "Membro — acesso operacional: cadastrar fornecedores, registrar interações, descargas e alertas."}
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
                      onChange={(e) => setInviteRole(e.target.value)}
                      className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="member">Membro</option>
                      <option value="admin">Admin</option>
                    </select>
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
      </section>

      <div className="border-t border-black/[0.04] my-8" />

      {/* WhatsApp */}
      <section>
        <h2 className="text-sm font-medium text-foreground flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          WhatsApp
        </h2>
        <div className="mt-4">
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
      </section>

      <div className="border-t border-black/[0.04] my-8" />

      {/* Alerts */}
      <section>
        <h2 className="text-sm font-medium text-foreground">Alertas</h2>
        <div className="mt-4 space-y-3">
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
      </section>

      <div className="border-t border-black/[0.04] my-8" />

      {/* Logout */}
      <section>
        <Button variant="ghost" onClick={handleLogout} className="text-muted-foreground hover:text-foreground">
          <LogOut className="mr-2 h-4 w-4" />
          Sair
        </Button>
      </section>
    </div>
  )
}
