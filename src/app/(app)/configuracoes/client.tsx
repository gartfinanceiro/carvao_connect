"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Loader2, LogOut, RefreshCw, User, Building2, Bell } from "lucide-react"
import { toast } from "sonner"

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
    <div className="p-4 md:p-6 space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">Configurações</h1>

      {/* Account */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" />
            Minha conta
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <div className="flex gap-2">
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Button
                className="bg-[#1B4332] hover:bg-[#2D6A4F]"
                onClick={handleSaveName}
                disabled={savingName || name.trim() === userName}
              >
                {savingName && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={userEmail} disabled />
          </div>
          <Separator />
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
        </CardContent>
      </Card>

      {/* Organization */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Organização
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{orgName || "Organização"}</p>
              <p className="text-xs text-muted-foreground">Nome da organização</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Plano:</span>
            <Badge className="bg-[#D8F3DC] text-[#1B4332] hover:bg-[#D8F3DC]">
              Trial — MVP
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Alerts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Alertas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Alertas de vencimento de documentos e fornecedores inativos são verificados diariamente.
          </p>
          <Button
            variant="outline"
            onClick={handleRefreshAlerts}
            disabled={refreshingAlerts}
          >
            {refreshingAlerts ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Atualizar alertas
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
