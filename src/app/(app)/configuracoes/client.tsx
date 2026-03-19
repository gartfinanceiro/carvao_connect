"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, LogOut, MessageSquare, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { WhatsAppSetup } from "@/components/whatsapp-setup"

interface ConfiguracoesClientProps {
  userName: string
  userEmail: string
  orgName: string
}

export function ConfiguracoesClient({
  userName,
  userEmail,
  orgName,
}: ConfiguracoesClientProps) {
  const router = useRouter()
  const [name, setName] = useState(userName)
  const [savingName, setSavingName] = useState(false)
  const [refreshingAlerts, setRefreshingAlerts] = useState(false)

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

      {/* Organization */}
      <section>
        <h2 className="text-sm font-medium text-foreground">Organização</h2>
        <div className="mt-4 space-y-2">
          <div>
            <p className="text-sm">{orgName || "Organização"}</p>
            <p className="text-xs text-muted-foreground">Nome da organização</p>
          </div>
          <p className="text-sm text-muted-foreground">
            Plano: Trial — MVP
          </p>
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
          <WhatsAppSetup />
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
