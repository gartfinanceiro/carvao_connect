"use client"

import { useCallback, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Loader2, Users, UserPlus, Copy, Check, Shield, ShieldOff, UserMinus, Settings,
} from "lucide-react"
import { toast } from "sonner"
import { useSubscription } from "@/components/subscription-provider"
import {
  PROFILE_TEMPLATES,
  MODULE_LABELS,
  MODULES,
  type Permissions,
  type ProfileTemplate,
  type ModuleKey,
} from "@/lib/permissions"

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

export function EquipeSection() {
  const { subscription, isAdmin } = useSubscription()
  const limits = subscription?.plan_limits

  const [members, setMembers] = useState<TeamMember[]>([])
  const [invites, setInvites] = useState<InviteItem[]>([])
  const [teamLoading, setTeamLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState("member")
  const [inviteLink, setInviteLink] = useState("")
  const [inviteLoading, setInviteLoading] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // Permissions modal state
  const [permModalOpen, setPermModalOpen] = useState(false)
  const [permMember, setPermMember] = useState<TeamMember | null>(null)
  const [permTemplate, setPermTemplate] = useState<ProfileTemplate | "custom">("completo")
  const [permModules, setPermModules] = useState<Permissions>({ ...PROFILE_TEMPLATES.completo.permissions })
  const [permSaving, setPermSaving] = useState(false)

  // Invite profile state
  const [inviteTemplate, setInviteTemplate] = useState<ProfileTemplate>("completo")

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

    const res = await fetch("/api/invites")
    const invData = await res.json()
    setInvites(
      (invData.invites ?? []).filter((i: InviteItem) => i.status === "pending")
    )
    setTeamLoading(false)
  }, [])

  useEffect(() => { fetchTeam() }, [fetchTeam])

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

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Equipe</h2>
            <p className="text-sm text-muted-foreground mt-1">Membros e permissões de acesso</p>
          </div>
          {limits && (
            <span className="text-[11px] font-medium text-muted-foreground bg-muted rounded-full px-2 py-0.5">
              {members.length}/{limits.max_users}
            </span>
          )}
        </div>

        <div className="rounded-xl border border-border bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5 space-y-4">
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
                  <div className="flex flex-wrap gap-2">
                    <Input
                      type="email"
                      placeholder="Email do colega"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="flex-1 min-w-[200px]"
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
    </>
  )
}
