"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, LogOut, ExternalLink } from "lucide-react"
import { toast } from "sonner"
import { useSubscription } from "@/components/subscription-provider"

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

interface ContaSectionProps {
  userName: string
  userEmail: string
  orgName: string
}

export function ContaSection({ userName, userEmail, orgName }: ContaSectionProps) {
  const router = useRouter()
  const { subscription, isAdmin } = useSubscription()
  const [name, setName] = useState(userName)
  const [savingName, setSavingName] = useState(false)
  const [loadingPortal, setLoadingPortal] = useState(false)
  const [supplierCount, setSupplierCount] = useState<number | null>(null)
  const [memberCount, setMemberCount] = useState<number>(0)

  const fetchCounts = useCallback(async () => {
    const supabase = createClient()
    const { count: activeSuppliers } = await supabase
      .from("suppliers")
      .select("id", { count: "exact", head: true })
      .eq("status", "ativo")
    setSupplierCount(activeSuppliers ?? 0)

    const { count: membersCount } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
    setMemberCount(membersCount ?? 0)
  }, [])

  useEffect(() => { fetchCounts() }, [fetchCounts])

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

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
  }

  const plan = subscription?.plan || "trial"
  const subStatus = subscription?.subscription_status || "trialing"
  const limits = subscription?.plan_limits
  const statusInfo = statusLabels[subStatus] || statusLabels.trialing

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Minha conta</h2>
        <p className="text-sm text-muted-foreground mt-1">Dados pessoais e acesso</p>
      </div>

      {/* Dados pessoais */}
      <div className="rounded-xl border border-border bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5 space-y-4">
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

      {/* Plano e assinatura */}
      <div className="rounded-xl border border-border bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Plano e assinatura</h3>
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

        {limits && (
          <div className="bg-[#F9F9F9] rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Uso do plano</p>
            <div className="space-y-2">
              <div className="flex justify-between text-[13px]">
                <span className="text-[#333]">Fornecedores</span>
                <span className="text-muted-foreground font-medium">
                  {supplierCount ?? "—"} / {limits.max_suppliers}
                </span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-[#333]">Usuários</span>
                <span className="text-muted-foreground font-medium">
                  {memberCount} / {limits.max_users}
                </span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-[#333]">WhatsApp + IA</span>
                <span className={`font-medium ${limits.whatsapp_enabled ? "text-emerald-600" : "text-[#999]"}`}>
                  {limits.whatsapp_enabled ? "Incluído" : "Não incluído"}
                </span>
              </div>
            </div>
          </div>
        )}

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

      {/* Sair */}
      <div className="rounded-xl border border-border bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5">
        <Button variant="ghost" onClick={handleLogout} className="text-muted-foreground hover:text-red-600">
          <LogOut className="mr-2 h-4 w-4" />
          Sair da conta
        </Button>
      </div>
    </div>
  )
}
