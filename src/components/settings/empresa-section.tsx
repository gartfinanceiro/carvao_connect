"use client"

import { useCallback, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { useSubscription } from "@/components/subscription-provider"

interface EmpresaSectionProps {
  orgName: string
}

export function EmpresaSection({ orgName }: EmpresaSectionProps) {
  const { isAdmin } = useSubscription()
  const [refreshingAlerts, setRefreshingAlerts] = useState(false)

  // Organization details state
  const [orgDoc, setOrgDoc] = useState("")
  const [orgAddress, setOrgAddress] = useState("")
  const [orgCity, setOrgCity] = useState("")
  const [orgState, setOrgState] = useState("")
  const [orgPhone, setOrgPhone] = useState("")
  const [orgStateReg, setOrgStateReg] = useState("")
  const [savingOrg, setSavingOrg] = useState(false)
  const [orgLoaded, setOrgLoaded] = useState(false)

  const fetchData = useCallback(async () => {
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

  useEffect(() => { fetchData() }, [fetchData])

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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Empresa</h2>
        <p className="text-sm text-muted-foreground mt-1">Informações da organização e alertas</p>
      </div>

      {/* Dados da empresa (admin only) */}
      {isAdmin && orgLoaded && (
        <div className="rounded-xl border border-border bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Dados da empresa</h3>
            <p className="text-xs text-muted-foreground mt-0.5">CNPJ, endereço e dados para o ticket de descarga</p>
          </div>
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
      )}

      {/* Alertas */}
      <div className="rounded-xl border border-border bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Alertas automáticos</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Lembretes de vencimentos e inatividade</p>
        </div>
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
  )
}
