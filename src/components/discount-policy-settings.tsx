"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Loader2, Plus, Trash2, Droplets, FlaskConical, BarChart3, Settings2, User, Building2, Upload, FileText, AlertTriangle, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/utils"
import { calculateDiscount, calculateAdjustedDensity, calculateImpurityDeduction, calculateMoistureWeightDeduction, findPriceByDensity } from "@/lib/discount-calculator"
import type { DiscountPolicy, MoistureRule, MoistureDiscountType, DensityPricingRule, PricingAdditionalRules, PricingUnit } from "@/types/database"

// ── Labels and colors ──────────────────────────────────────────────
const MOISTURE_TYPE_CONFIG: Record<MoistureDiscountType, { shortLabel: string; color: string; bg: string; description: string }> = {
  none: {
    shortLabel: "Sem desconto",
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    description: "Nenhum desconto aplicado nesta faixa",
  },
  excess: {
    shortLabel: "Excedente no peso",
    color: "text-amber-700",
    bg: "bg-amber-50",
    description: "Desconta apenas o % que excede o início da faixa",
  },
  total: {
    shortLabel: "Total no peso",
    color: "text-red-600",
    bg: "bg-red-50",
    description: "Desconta toda a umidade medida",
  },
}

const DEFAULT_RULES: MoistureRule[] = [
  { from: 0, to: 7.99, type: "none" },
  { from: 8, to: 14.99, type: "excess" },
  { from: 15, to: 100, type: "total" },
]

// ── Component ──────────────────────────────────────────────────────
export function DiscountPolicySettings() {
  const [policy, setPolicy] = useState<DiscountPolicy | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Form state
  const [moistureRules, setMoistureRules] = useState<MoistureRule[]>(DEFAULT_RULES)
  const [densityRules, setDensityRules] = useState<DensityPricingRule[]>([])
  const [additionalRules, setAdditionalRules] = useState<PricingAdditionalRules>({})
  const [effectiveDate, setEffectiveDate] = useState("")
  const [sourceDocUrl, setSourceDocUrl] = useState<string | null>(null)

  // Import dialog
  type ImportStatus = "idle" | "uploading" | "extracting" | "preview" | "error"
  const [importOpen, setImportOpen] = useState(false)
  const [importStatus, setImportStatus] = useState<ImportStatus>("idle")
  const [importError, setImportError] = useState("")
  const [importData, setImportData] = useState<Record<string, unknown> | null>(null)
  const [importFilePath, setImportFilePath] = useState<string | null>(null)
  const importFileRef = useRef<HTMLInputElement>(null)

  // Simulator
  const [simMoisture, setSimMoisture] = useState("")
  const [simFines, setSimFines] = useState("")
  const [simNetWeight, setSimNetWeight] = useState("")
  const [simVolume, setSimVolume] = useState("")
  const [simPersonType, setSimPersonType] = useState<"pf" | "pj">("pf")

  const fetchPolicy = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from("discount_policies")
      .select("*")
      .eq("is_active", true)
      .maybeSingle()

    if (!error && data) {
      setPolicy(data as DiscountPolicy)
      setMoistureRules(data.moisture_rules as MoistureRule[])
      setDensityRules((data.density_pricing_rules as DensityPricingRule[]) || [])
      setAdditionalRules((data.additional_rules as PricingAdditionalRules) || {})
      setEffectiveDate(data.effective_date || "")
      setSourceDocUrl(data.source_document_url || null)
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchPolicy() }, [fetchPolicy])

  // ── Moisture Handlers ──────────────────────────────────────────
  function updateMoistureRule(index: number, field: keyof MoistureRule, value: string | MoistureDiscountType) {
    setMoistureRules((prev) =>
      prev.map((rule, i) =>
        i === index ? { ...rule, [field]: field === "type" ? value : Number(value) } : rule
      )
    )
  }

  function addMoistureRule() {
    const lastRule = moistureRules[moistureRules.length - 1]
    const newFrom = lastRule ? Math.round((lastRule.to + 0.01) * 100) / 100 : 0
    setMoistureRules((prev) => [...prev, { from: newFrom, to: 100, type: "total" as MoistureDiscountType }])
  }

  function removeMoistureRule(index: number) {
    if (moistureRules.length <= 1) return
    setMoistureRules((prev) => prev.filter((_, i) => i !== index))
  }

  // ── Density Pricing Handlers ───────────────────────────────────
  function updateDensityRule(index: number, field: "min_density" | "max_density" | "price_per_mdc" | "pricing_unit", value: string) {
    setDensityRules((prev) =>
      prev.map((rule, i) => {
        if (i !== index) return rule
        if (field === "pricing_unit") {
          return { ...rule, pricing_unit: (value || "mdc") as PricingUnit }
        }
        return { ...rule, [field]: Number(value) }
      })
    )
  }

  function addDensityRuleForType(personType: "pf" | "pj") {
    const typeRules = densityRules.filter(r => r.person_type === personType)
    const lastRule = typeRules[typeRules.length - 1]
    const newMin = lastRule ? Math.round((lastRule.max_density + 0.01) * 100) / 100 : 180
    setDensityRules((prev) => [...prev, { person_type: personType, min_density: newMin, max_density: newMin + 20, price_per_mdc: 0 }])
  }

  function removeDensityRule(index: number) {
    setDensityRules((prev) => prev.filter((_, i) => i !== index))
  }

  function copyRulesToOtherType(fromType: "pf" | "pj") {
    const toType = fromType === "pf" ? "pj" : "pf"
    const sourceRules = densityRules.filter(r => r.person_type === fromType)
    if (sourceRules.length === 0) {
      toast.error(`Nenhuma faixa ${fromType.toUpperCase()} para copiar.`)
      return
    }
    const withoutTarget = densityRules.filter(r => r.person_type !== toType)
    const copiedRules = sourceRules.map(r => ({ ...r, person_type: toType as "pf" | "pj" }))
    setDensityRules([...withoutTarget, ...copiedRules])
    toast.success(`Faixas copiadas de ${fromType.toUpperCase()} para ${toType.toUpperCase()}.`)
  }

  // ── Additional Rules Handlers ──────────────────────────────────
  function updateAdditional<K extends keyof PricingAdditionalRules>(field: K, value: PricingAdditionalRules[K]) {
    setAdditionalRules((prev) => ({ ...prev, [field]: value }))
  }

  // ── Import Handlers ─────────────────────────────────────────────
  function resetImport() {
    setImportStatus("idle")
    setImportError("")
    setImportData(null)
    setImportFilePath(null)
  }

  function handleImportOpen() {
    resetImport()
    setImportOpen(true)
  }

  async function handleImportFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo: 10MB.")
      return
    }

    // 1. Upload to Supabase Storage
    setImportStatus("uploading")
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setImportStatus("error"); setImportError("Sessão expirada."); return }

    const { data: profile } = await supabase.from("profiles").select("organization_id").eq("id", user.id).single()
    if (!profile?.organization_id) { setImportStatus("error"); setImportError("Organização não encontrada."); return }

    const timestamp = Date.now()
    const ext = file.name.split(".").pop()?.toLowerCase() || "pdf"
    const filePath = `${profile.organization_id}/tabela_${timestamp}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from("pricing-documents")
      .upload(filePath, file)

    if (uploadError) {
      console.error("Upload error:", uploadError)
      setImportStatus("error")
      setImportError("Erro ao enviar arquivo.")
      return
    }

    // 2. Call extraction API
    setImportStatus("extracting")
    try {
      const res = await fetch("/api/extract-pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_path: filePath }),
      })

      const result = await res.json()

      if (!res.ok) {
        if (result.code === "NO_API_KEY") {
          setImportStatus("error")
          setImportError("Configuração necessária: entre em contato com o suporte para ativar a importação automática.")
        } else {
          setImportStatus("error")
          setImportError(result.error || "Erro na extração.")
        }
        return
      }

      setImportData(result.data)
      setImportFilePath(result.source_document_url)
      setImportStatus("preview")
    } catch {
      setImportStatus("error")
      setImportError("Erro de conexão. Tente novamente.")
    }
  }

  function handleApplyImport() {
    if (!importData) return

    // Apply density pricing rules
    const rules = importData.density_pricing_rules as DensityPricingRule[] | undefined
    if (rules && Array.isArray(rules) && rules.length > 0) {
      setDensityRules(rules)
    }

    // Apply moisture rules
    const moisture = importData.moisture_rules as MoistureRule[] | undefined
    if (moisture && Array.isArray(moisture) && moisture.length > 0) {
      setMoistureRules(moisture)
    }

    // Apply additional rules
    const additional = importData.additional_rules as PricingAdditionalRules | undefined
    if (additional && typeof additional === "object") {
      setAdditionalRules(additional)
    }

    // Apply effective date
    const effDate = importData.effective_date as string | undefined
    if (effDate) {
      setEffectiveDate(effDate)
    }

    // Apply impurity rules if present
    const impurity = importData.impurity_rules as { tolerance_percent?: number; discount_on?: string } | undefined
    if (impurity && typeof impurity === "object") {
      // These are stored in the policy but not as separate state — they'll be saved via additionalRules or direct payload
    }

    // Store source document URL
    if (importFilePath) {
      setSourceDocUrl(importFilePath)
    }

    setImportOpen(false)
    toast.success("Dados importados! Revise e clique em Salvar.")
  }

  // ── Save ───────────────────────────────────────────────────────
  async function handleSave() {
    // Validate moisture rules
    const sortedMoisture = [...moistureRules].sort((a, b) => a.from - b.from)
    for (let i = 0; i < sortedMoisture.length - 1; i++) {
      if (sortedMoisture[i].to >= sortedMoisture[i + 1].from) {
        toast.error(`As faixas de umidade ${i + 1} e ${i + 2} se sobrepõem.`)
        return
      }
    }

    // Validate density rules by person_type group
    const sortedDensity = [...densityRules].sort((a, b) => a.min_density - b.min_density)
    const groups = new Map<string, DensityPricingRule[]>()
    for (const rule of sortedDensity) {
      const key = rule.person_type || "_all"
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(rule)
    }
    for (const [, groupRules] of groups) {
      const sorted = [...groupRules].sort((a, b) => a.min_density - b.min_density)
      for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i].max_density >= sorted[i + 1].min_density) {
          const label = sorted[i].person_type ? ` (${sorted[i].person_type!.toUpperCase()})` : ""
          toast.error(`Faixas de densidade se sobrepõem${label}.`)
          return
        }
      }
    }

    for (const rule of sortedDensity) {
      if (rule.price_per_mdc <= 0) {
        toast.error("Todas as faixas de densidade devem ter um preço maior que zero.")
        return
      }
    }

    setSaving(true)
    const supabase = createClient()

    const payload = {
      moisture_rules: sortedMoisture,
      density_pricing_rules: sortedDensity,
      additional_rules: additionalRules,
      effective_date: effectiveDate || null,
      source_document_url: sourceDocUrl,
      is_active: true,
    }

    if (policy) {
      const { error } = await supabase.from("discount_policies").update(payload).eq("id", policy.id)
      if (error) { console.error(error); toast.error("Erro ao salvar."); setSaving(false); return }
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { toast.error("Usuário não autenticado."); setSaving(false); return }
      const { data: profile } = await supabase.from("profiles").select("organization_id").eq("id", user.id).single()
      if (!profile?.organization_id) { toast.error("Organização não encontrada."); setSaving(false); return }

      const { error } = await supabase.from("discount_policies").insert({
        ...payload, name: "Política padrão", organization_id: profile.organization_id, created_by: user.id,
        impurity_tolerance_percent: 0, impurity_discount_on: "net",
      })
      if (error) { console.error(error); toast.error("Erro ao criar política."); setSaving(false); return }
    }

    toast.success("Tabela de preços salva!")
    setSaving(false)
    fetchPolicy()
  }

  // ── Simulation ─────────────────────────────────────────────────
  const simulationResult = (() => {
    const vol = Number(simVolume) || 0
    const netW = Number(simNetWeight) || 0
    const finesKg = Number(simFines) || 0
    const moistPct = Number(simMoisture) || 0

    if (vol <= 0 || netW <= 0) return null

    const { deductionKg: moistureKg, rule: moistureRule } = calculateMoistureWeightDeduction(moistPct, netW, moistureRules)

    // Impurity with tolerance from policy
    const impTolerance = policy?.impurity_tolerance_percent ?? 0
    const impDiscountOn = policy?.impurity_discount_on ?? "net"
    const impurityResult = finesKg > 0
      ? calculateImpurityDeduction(finesKg, netW, netW, impTolerance, impDiscountOn)
      : null
    const effectiveFines = impurityResult?.deductionKg ?? finesKg

    const adjustedW = netW - moistureKg - effectiveFines
    const adjDensity = calculateAdjustedDensity(netW, effectiveFines, vol, moistureKg)

    // Price lookup with person_type
    const densityLookupPf = adjDensity ? findPriceByDensity(densityRules, adjDensity, "pf") : null
    const densityLookupPj = adjDensity ? findPriceByDensity(densityRules, adjDensity, "pj") : null
    const densityLookup = simPersonType === "pf" ? densityLookupPf : densityLookupPj
    const price = densityLookup ? densityLookup.price : 0

    const result = calculateDiscount(
      {
        id: "sim", organization_id: "", name: "", is_active: true,
        moisture_rules: moistureRules,
        impurity_tolerance_percent: impTolerance,
        impurity_discount_on: impDiscountOn,
        density_pricing_rules: densityRules,
        created_by: null, created_at: "", updated_at: "",
      },
      {
        moisturePercent: moistPct,
        finesKg,
        netWeightKg: netW, grossWeightKg: netW,
        volumeMdc: vol, priceMdc: price,
        densityKgMdc: adjDensity,
      }
    )

    return { ...result, adjDensity, adjustedW, moistureKg, moistureRule, price, densityLookup, densityLookupPf, densityLookupPj, impurityResult }
  })()

  // ── Helpers ────────────────────────────────────────────────────
  const pfRules = densityRules.filter(r => r.person_type === "pf")
  const pjRules = densityRules.filter(r => r.person_type === "pj")

  function getDensityRuleGlobalIndex(personType: "pf" | "pj", localIndex: number): number {
    const typeRules = densityRules
      .map((rule, idx) => ({ rule, idx }))
      .filter(({ rule }) => rule.person_type === personType)
    return typeRules[localIndex]?.idx ?? -1
  }

  // ── Render ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Vigência */}
      {effectiveDate && (
        <p className="text-xs text-muted-foreground">
          Vigência: <strong>{new Date(effectiveDate + "T12:00:00").toLocaleDateString("pt-BR")}</strong>
        </p>
      )}

      <Tabs defaultValue="precos">
        <TabsList className="w-full">
          <TabsTrigger value="precos" className="flex-1 gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" />
            Faixas de Preço
          </TabsTrigger>
          <TabsTrigger value="descontos" className="flex-1 gap-1.5">
            <Droplets className="h-3.5 w-3.5" />
            Descontos
          </TabsTrigger>
          <TabsTrigger value="regras" className="flex-1 gap-1.5">
            <Settings2 className="h-3.5 w-3.5" />
            Regras Gerais
          </TabsTrigger>
          <TabsTrigger value="simulador" className="flex-1 gap-1.5">
            <FlaskConical className="h-3.5 w-3.5" />
            Simulador
          </TabsTrigger>
        </TabsList>

        {/* ── Tab: Faixas de Preço ───────────────────────────────── */}
        <TabsContent value="precos" className="space-y-5 pt-3">
          <div className="bg-[#F9F9F9] rounded-lg p-3">
            <p className="text-xs text-muted-foreground leading-relaxed">
              A densidade é calculada com o <strong>peso ajustado</strong> (peso líquido - umidade - impurezas).
              Configure faixas de preço separadas para Pessoa Física e Pessoa Jurídica.
            </p>
          </div>

          {/* PF Group */}
          <DensityGroup
            label="Pessoa Física"
            icon={<User className="h-3.5 w-3.5 text-blue-600" />}
            badgeColor="bg-blue-100 text-blue-700"
            rules={pfRules}
            onUpdate={(localIdx, field, value) => {
              const globalIdx = getDensityRuleGlobalIndex("pf", localIdx)
              if (globalIdx >= 0) updateDensityRule(globalIdx, field, value)
            }}
            onRemove={(localIdx) => {
              const globalIdx = getDensityRuleGlobalIndex("pf", localIdx)
              if (globalIdx >= 0) removeDensityRule(globalIdx)
            }}
            onAdd={() => addDensityRuleForType("pf")}
            onCopy={() => copyRulesToOtherType("pf")}
            copyLabel="Copiar para PJ"
          />

          {/* PJ Group */}
          <DensityGroup
            label="Pessoa Jurídica"
            icon={<Building2 className="h-3.5 w-3.5 text-purple-600" />}
            badgeColor="bg-purple-100 text-purple-700"
            rules={pjRules}
            onUpdate={(localIdx, field, value) => {
              const globalIdx = getDensityRuleGlobalIndex("pj", localIdx)
              if (globalIdx >= 0) updateDensityRule(globalIdx, field, value)
            }}
            onRemove={(localIdx) => {
              const globalIdx = getDensityRuleGlobalIndex("pj", localIdx)
              if (globalIdx >= 0) removeDensityRule(globalIdx)
            }}
            onAdd={() => addDensityRuleForType("pj")}
            onCopy={() => copyRulesToOtherType("pj")}
            copyLabel="Copiar para PF"
          />
        </TabsContent>

        {/* ── Tab: Descontos ─────────────────────────────────────── */}
        <TabsContent value="descontos" className="space-y-4 pt-3">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <Droplets className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground">Umidade</h4>
              <p className="text-xs text-muted-foreground">Faixas de tolerância e desconto por umidade no peso</p>
            </div>
          </div>

          <div className="rounded-xl border border-border/50 overflow-hidden">
            <div className="grid grid-cols-[1fr_1fr_2fr_40px] gap-2 px-3 py-2 bg-muted/30 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span>De (%)</span>
              <span>Até (%)</span>
              <span>Tipo de desconto</span>
              <span />
            </div>

            {moistureRules.map((rule, index) => {
              const config = MOISTURE_TYPE_CONFIG[rule.type]
              return (
                <div
                  key={index}
                  className={`grid grid-cols-[1fr_1fr_2fr_40px] gap-2 px-3 py-2.5 items-center border-t border-border/30 ${config.bg}`}
                >
                  <Input
                    type="number"
                    value={rule.from}
                    onChange={(e) => updateMoistureRule(index, "from", e.target.value)}
                    className="h-8 text-sm bg-white"
                    step="0.01" min={0}
                  />
                  <Input
                    type="number"
                    value={rule.to}
                    onChange={(e) => updateMoistureRule(index, "to", e.target.value)}
                    className="h-8 text-sm bg-white"
                    step="0.01" min={0}
                  />
                  <Select value={rule.type} onValueChange={(v) => updateMoistureRule(index, "type", v as MoistureDiscountType)}>
                    <SelectTrigger className={`h-8 text-sm ${config.color} font-medium bg-white`}>
                      <SelectValue>
                        {(value: string) => MOISTURE_TYPE_CONFIG[value as MoistureDiscountType]?.shortLabel || value}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.entries(MOISTURE_TYPE_CONFIG) as [MoistureDiscountType, typeof config][]).map(([key, cfg]) => (
                        <SelectItem key={key} value={key}>
                          <div>
                            <span className={`font-medium ${cfg.color}`}>{cfg.shortLabel}</span>
                            <span className="text-xs text-muted-foreground ml-2">— {cfg.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <button
                    type="button"
                    onClick={() => removeMoistureRule(index)}
                    disabled={moistureRules.length <= 1}
                    className="h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground/50 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )
            })}
          </div>

          <Button type="button" variant="outline" size="sm" onClick={addMoistureRule} className="text-xs">
            <Plus className="mr-1 h-3 w-3" /> Adicionar faixa
          </Button>
        </TabsContent>

        {/* ── Tab: Regras Gerais ─────────────────────────────────── */}
        <TabsContent value="regras" className="space-y-4 pt-3">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center">
              <Settings2 className="h-4 w-4 text-slate-600" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground">Regras Gerais</h4>
              <p className="text-xs text-muted-foreground">Condições comerciais e informações da tabela de preços</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Data de vigência</Label>
                <Input
                  type="date"
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Tolerância de medição (%)</Label>
                <Input
                  type="number"
                  value={additionalRules.metering_tolerance_percent ?? ""}
                  onChange={(e) => updateAdditional("metering_tolerance_percent", e.target.value ? Number(e.target.value) : undefined)}
                  placeholder="ex: 2"
                  className="h-8 text-sm"
                  step="0.1" min={0}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Forma de pagamento</Label>
                <Input
                  value={additionalRules.payment_method ?? ""}
                  onChange={(e) => updateAdditional("payment_method", e.target.value || undefined)}
                  placeholder="ex: Depósito bancário"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Prazo de pagamento</Label>
                <Input
                  value={additionalRules.payment_deadline ?? ""}
                  onChange={(e) => updateAdditional("payment_deadline", e.target.value || undefined)}
                  placeholder="ex: 15 dias após descarga"
                  className="h-8 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Espécie exigida</Label>
                <Input
                  value={additionalRules.species_required ?? ""}
                  onChange={(e) => updateAdditional("species_required", e.target.value || undefined)}
                  placeholder="ex: Eucalipto"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Regra de pagamento a terceiros</Label>
                <Input
                  value={additionalRules.third_party_payment_rule ?? ""}
                  onChange={(e) => updateAdditional("third_party_payment_rule", e.target.value || undefined)}
                  placeholder="ex: Somente com autorização"
                  className="h-8 text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Observações</Label>
              <textarea
                value={additionalRules.notes ?? ""}
                onChange={(e) => updateAdditional("notes", e.target.value || undefined)}
                placeholder="Condições especiais, restrições, etc."
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px] resize-y focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                rows={2}
              />
            </div>
          </div>
        </TabsContent>

        {/* ── Tab: Simulador ─────────────────────────────────────── */}
        <TabsContent value="simulador" className="space-y-4 pt-3">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center">
              <FlaskConical className="h-4 w-4 text-indigo-600" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground">Simulador</h4>
              <p className="text-xs text-muted-foreground">Simule uma descarga para conferir preço e descontos</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground uppercase tracking-wide">Tipo Pessoa</Label>
              <Select value={simPersonType} onValueChange={(v) => v && setSimPersonType(v as "pf" | "pj")}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue>
                    {(value: string) => value === "pf" ? "PF" : "PJ"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pf">Pessoa Física</SelectItem>
                  <SelectItem value="pj">Pessoa Jurídica</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground uppercase tracking-wide">Peso líquido (kg)</Label>
              <Input type="number" value={simNetWeight} onChange={(e) => setSimNetWeight(e.target.value)} placeholder="25000" className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground uppercase tracking-wide">Volume (MDC)</Label>
              <Input type="number" value={simVolume} onChange={(e) => setSimVolume(e.target.value)} placeholder="121" className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground uppercase tracking-wide">Umidade (%)</Label>
              <Input type="number" value={simMoisture} onChange={(e) => setSimMoisture(e.target.value)} placeholder="12" className="h-8 text-sm" step="0.1" />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground uppercase tracking-wide">Impurezas (kg)</Label>
              <Input type="number" value={simFines} onChange={(e) => setSimFines(e.target.value)} placeholder="1000" className="h-8 text-sm" />
            </div>
          </div>

          {/* Result */}
          {simulationResult && (
            <div className="rounded-lg p-4 space-y-3 bg-muted/40 border border-border/40">
              {/* Weight breakdown */}
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Cálculo de peso</p>
                <div className="text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Peso líquido</span>
                    <span className="font-medium">{(Number(simNetWeight) || 0).toLocaleString("pt-BR")} kg</span>
                  </div>
                  {simulationResult.moistureKg > 0 && (
                    <div className="flex justify-between text-amber-700">
                      <span>Desc. umidade ({Number(simMoisture)}% {simulationResult.moistureRule?.type === "excess" ? "excedente" : "total"})</span>
                      <span className="font-medium">-{simulationResult.moistureKg.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kg</span>
                    </div>
                  )}
                  {(Number(simFines) || 0) > 0 && simulationResult.impurityResult && (
                    simulationResult.impurityResult.withinTolerance ? (
                      <div className="flex justify-between text-emerald-700">
                        <span>Desc. impurezas ({simulationResult.impurityResult.finesPercent.toFixed(1)}% — tolerância {simulationResult.impurityResult.tolerancePercent}%)</span>
                        <span className="font-medium">0 kg</span>
                      </div>
                    ) : (
                      <div className="flex justify-between text-amber-700">
                        <span>Desc. impurezas{simulationResult.impurityResult.tolerancePercent > 0 ? ` (${simulationResult.impurityResult.finesPercent.toFixed(1)}% — acima de ${simulationResult.impurityResult.tolerancePercent}%)` : ""}</span>
                        <span className="font-medium">-{(Number(simFines) || 0).toLocaleString("pt-BR")} kg</span>
                      </div>
                    )
                  )}
                  {(Number(simFines) || 0) > 0 && !simulationResult.impurityResult && (
                    <div className="flex justify-between text-amber-700">
                      <span>Desc. impurezas</span>
                      <span className="font-medium">-{(Number(simFines) || 0).toLocaleString("pt-BR")} kg</span>
                    </div>
                  )}
                  {(simulationResult.moistureKg > 0 || (Number(simFines) || 0) > 0) && (
                    <div className="flex justify-between pt-1 border-t border-border/40 font-semibold">
                      <span>Peso ajustado</span>
                      <span>{Math.max(simulationResult.adjustedW, 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kg</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Density + Price */}
              {simulationResult.adjDensity && (
                <div className="space-y-1.5 pt-2 border-t border-border/40">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Densidade e Preço</p>
                  <div className="text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Densidade ajustada</span>
                      <span className="font-semibold text-[#1B4332]">{simulationResult.adjDensity.toFixed(2)} kg/MDC</span>
                    </div>

                    {/* Show both PF and PJ prices */}
                    {(simulationResult.densityLookupPf || simulationResult.densityLookupPj) && (
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        <div className={`rounded-lg p-2 border ${simPersonType === "pf" ? "border-blue-300 bg-blue-50" : "border-border/40 bg-white"}`}>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase">PF</p>
                          {simulationResult.densityLookupPf ? (
                            <p className="text-sm font-bold text-foreground">
                              {formatCurrency(simulationResult.densityLookupPf.price)}/{simulationResult.densityLookupPf.pricingUnit === "ton" ? "ton" : "MDC"}
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground">Sem faixa</p>
                          )}
                        </div>
                        <div className={`rounded-lg p-2 border ${simPersonType === "pj" ? "border-purple-300 bg-purple-50" : "border-border/40 bg-white"}`}>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase">PJ</p>
                          {simulationResult.densityLookupPj ? (
                            <p className="text-sm font-bold text-foreground">
                              {formatCurrency(simulationResult.densityLookupPj.price)}/{simulationResult.densityLookupPj.pricingUnit === "ton" ? "ton" : "MDC"}
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground">Sem faixa</p>
                          )}
                        </div>
                      </div>
                    )}

                    {!simulationResult.densityLookupPf && !simulationResult.densityLookupPj && densityRules.length > 0 && (
                      <p className="text-xs text-red-600 font-medium mt-1">
                        Densidade {simulationResult.adjDensity.toFixed(2)} fora das faixas configuradas
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Total */}
              {simulationResult.price > 0 && (() => {
                const lookup = simulationResult.densityLookup
                const unit = lookup?.pricingUnit || "mdc"
                const adjW = simulationResult.adjustedW
                let qty: number
                let qtyLabel: string
                let total: number
                if (unit === "ton" && adjW > 0) {
                  qty = Math.round((adjW / 1000) * 100) / 100
                  qtyLabel = `${qty.toFixed(2)} ton`
                  total = Math.round(qty * simulationResult.price * 100) / 100
                } else {
                  qty = Number(simVolume) || 0
                  qtyLabel = `${qty} MDC`
                  total = Math.round(qty * simulationResult.price * 100) / 100
                }
                return (
                  <div className="pt-2 border-t border-border/40">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Valor bruto ({simPersonType.toUpperCase()}{unit === "ton" ? " — por tonelada" : ""})</span>
                      <span>{qtyLabel} x {formatCurrency(simulationResult.price)} = <strong>{formatCurrency(total)}</strong></span>
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-sm font-semibold text-[#1B4332]">Valor a pagar</span>
                      <span className="text-lg font-bold text-[#1B4332]">{formatCurrency(total)}</span>
                    </div>
                  </div>
                )
              })()}
            </div>
          )}
          {!simulationResult && (
            <p className="text-xs text-muted-foreground">Preencha peso líquido e volume para ver o resultado.</p>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Actions ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-between pt-2">
        <Button type="button" variant="outline" size="sm" onClick={handleImportOpen} className="text-xs gap-1.5">
          <Upload className="h-3.5 w-3.5" />
          Importar tabela (PDF)
        </Button>
        <Button onClick={handleSave} className="bg-[#1B4332] hover:bg-[#2D6A4F]" disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {policy ? "Salvar alterações" : "Criar política"}
        </Button>
      </div>

      {/* ── Import Dialog ────────────────────────────────────────── */}
      <input
        ref={importFileRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        className="hidden"
        onChange={handleImportFileSelected}
      />
      <Dialog open={importOpen} onOpenChange={(open) => { if (!open) setImportOpen(false) }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Importar tabela de preços
            </DialogTitle>
          </DialogHeader>

          {/* Idle — file select */}
          {importStatus === "idle" && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Envie o PDF ou imagem da tabela de preços. A IA vai extrair automaticamente as faixas de preço, regras de umidade e informações gerais.
              </p>
              <div
                onClick={() => importFileRef.current?.click()}
                className="border-2 border-dashed border-border/60 rounded-xl p-8 text-center cursor-pointer hover:border-[#1B4332]/40 hover:bg-muted/20 transition-colors"
              >
                <Upload className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm font-medium text-muted-foreground">Clique para selecionar arquivo</p>
                <p className="text-xs text-muted-foreground/60 mt-1">PDF, JPG ou PNG — máx. 10MB</p>
              </div>
            </div>
          )}

          {/* Uploading */}
          {importStatus === "uploading" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-[#1B4332]" />
              <p className="text-sm text-muted-foreground">Enviando arquivo...</p>
            </div>
          )}

          {/* Extracting */}
          {importStatus === "extracting" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-[#1B4332]" />
              <p className="text-sm text-muted-foreground">Analisando tabela com IA...</p>
              <p className="text-xs text-muted-foreground/60">Isso pode levar alguns segundos</p>
            </div>
          )}

          {/* Error */}
          {importStatus === "error" && (
            <div className="space-y-4">
              <div className="rounded-lg bg-red-50 border border-red-200/60 p-4 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{importError}</p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setImportOpen(false)}>Fechar</Button>
                <Button onClick={() => { resetImport(); importFileRef.current?.click() }}>
                  Tentar novamente
                </Button>
              </DialogFooter>
            </div>
          )}

          {/* Preview */}
          {importStatus === "preview" && importData && (
            <div className="space-y-4">
              {/* Confidence alert */}
              {importData.confidence === "low" && (
                <div className="rounded-lg bg-amber-50 border border-amber-200/60 p-3 flex items-start gap-2.5">
                  <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700">A extração pode conter imprecisões. Revise cuidadosamente antes de aplicar.</p>
                </div>
              )}
              {importData.confidence === "medium" && (
                <div className="rounded-lg bg-blue-50 border border-blue-200/60 p-3 flex items-start gap-2.5">
                  <AlertTriangle className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700">Revise os dados extraídos antes de confirmar.</p>
                </div>
              )}
              {importData.confidence === "high" && (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200/60 p-3 flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-emerald-700">Dados extraídos com alta confiança.</p>
                </div>
              )}

              {/* Density rules preview */}
              {Array.isArray(importData.density_pricing_rules) && (importData.density_pricing_rules as DensityPricingRule[]).length > 0 ? (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Faixas de Preço</p>
                  {(["pf", "pj"] as const).map(pt => {
                    const rules = (importData.density_pricing_rules as DensityPricingRule[]).filter(r => r.person_type === pt)
                    if (rules.length === 0) return null
                    return (
                      <div key={pt} className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">{pt === "pf" ? "Pessoa Física" : "Pessoa Jurídica"}</p>
                        <div className="rounded-lg border border-border/50 overflow-hidden">
                          <div className="grid grid-cols-3 gap-2 px-3 py-1.5 bg-muted/30 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            <span>Densidade</span>
                            <span>Até</span>
                            <span>Preço/MDC</span>
                          </div>
                          {rules.map((rule, i) => (
                            <div key={i} className="grid grid-cols-3 gap-2 px-3 py-1.5 text-xs border-t border-border/30">
                              <span>{rule.min_density}</span>
                              <span>{rule.max_density === 99999 ? "+" : rule.max_density}</span>
                              <span className="font-medium">{formatCurrency(rule.price_per_mdc)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : null}

              {/* Moisture rules preview */}
              {Array.isArray(importData.moisture_rules) && (importData.moisture_rules as MoistureRule[]).length > 0 ? (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Regras de Umidade</p>
                  <div className="rounded-lg border border-border/50 overflow-hidden">
                    {(importData.moisture_rules as MoistureRule[]).map((rule, i) => {
                      const config = MOISTURE_TYPE_CONFIG[rule.type] || MOISTURE_TYPE_CONFIG.none
                      return (
                        <div key={i} className={`flex items-center justify-between px-3 py-1.5 text-xs ${i > 0 ? "border-t border-border/30" : ""} ${config.bg}`}>
                          <span>{rule.from}% – {rule.to}%</span>
                          <span className={`font-medium ${config.color}`}>{config.shortLabel}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : null}

              {/* Additional rules preview */}
              {importData.additional_rules && typeof importData.additional_rules === "object" ? (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Informações Gerais</p>
                  <div className="text-xs space-y-1 bg-[#F9F9F9] rounded-lg p-3">
                    {Object.entries(importData.additional_rules as Record<string, unknown>).filter(([, v]) => v != null && v !== "").map(([key, value]) => {
                      const labels: Record<string, string> = {
                        metering_tolerance_percent: "Tolerância de medição",
                        payment_method: "Forma de pagamento",
                        payment_deadline: "Prazo de pagamento",
                        species_required: "Espécie exigida",
                        third_party_payment_rule: "Pagamento a terceiros",
                        notes: "Observações",
                      }
                      return (
                        <div key={key} className="flex justify-between">
                          <span className="text-muted-foreground">{labels[key] || key}</span>
                          <span className="font-medium text-right max-w-[60%]">{String(value)}{key === "metering_tolerance_percent" ? "%" : ""}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : null}

              {importData.effective_date ? (
                <p className="text-xs text-muted-foreground">
                  Vigência: <strong>{new Date(String(importData.effective_date) + "T12:00:00").toLocaleDateString("pt-BR")}</strong>
                </p>
              ) : null}

              <DialogFooter>
                <Button variant="outline" onClick={() => setImportOpen(false)}>Cancelar</Button>
                <Button onClick={handleApplyImport} className="bg-[#1B4332] hover:bg-[#2D6A4F]">
                  Aplicar dados
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Density Group Sub-component ─────────────────────────────────────
function DensityGroup({
  label,
  icon,
  badgeColor,
  rules,
  onUpdate,
  onRemove,
  onAdd,
  onCopy,
  copyLabel,
}: {
  label: string
  icon: React.ReactNode
  badgeColor: string
  rules: DensityPricingRule[]
  onUpdate: (localIndex: number, field: "min_density" | "max_density" | "price_per_mdc" | "pricing_unit", value: string) => void
  onRemove: (localIndex: number) => void
  onAdd: () => void
  onCopy: () => void
  copyLabel: string
}) {
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`h-6 w-6 rounded-md flex items-center justify-center ${badgeColor.includes("blue") ? "bg-blue-50" : "bg-purple-50"}`}>
            {icon}
          </div>
          <h4 className="text-sm font-semibold text-foreground">{label}</h4>
          <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${badgeColor}`}>
            {rules.length} {rules.length === 1 ? "faixa" : "faixas"}
          </span>
        </div>
        {rules.length > 0 && (
          <Button type="button" variant="ghost" size="sm" onClick={onCopy} className="text-[11px] text-muted-foreground h-7 px-2">
            {copyLabel}
          </Button>
        )}
      </div>

      {/* Table */}
      {rules.length > 0 && (
        <div className="rounded-xl border border-border/50 overflow-hidden">
          <div className="grid grid-cols-[1fr_1fr_80px_1fr_40px] gap-2 px-3 py-2 bg-muted/30 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <span>De (kg/MDC)</span>
            <span>Até (kg/MDC)</span>
            <span>Unidade</span>
            <span>Preço (R$)</span>
            <span />
          </div>

          {rules.map((rule, localIndex) => (
            <div
              key={localIndex}
              className={`grid grid-cols-[1fr_1fr_80px_1fr_40px] gap-2 px-3 py-2.5 items-center border-t border-border/30 ${badgeColor.includes("blue") ? "bg-blue-50/30" : "bg-purple-50/30"}`}
            >
              <Input
                type="number"
                value={rule.min_density}
                onChange={(e) => onUpdate(localIndex, "min_density", e.target.value)}
                className="h-8 text-sm bg-white"
                step="0.01" min={0}
              />
              <Input
                type="number"
                value={rule.max_density}
                onChange={(e) => onUpdate(localIndex, "max_density", e.target.value)}
                className="h-8 text-sm bg-white"
                step="0.01" min={0}
              />
              <Select value={rule.pricing_unit || "mdc"} onValueChange={(v) => onUpdate(localIndex, "pricing_unit", v ?? "mdc")}>
                <SelectTrigger className="h-8 text-sm bg-white">
                  <SelectValue>
                    {(value: string) => value === "ton" ? "ton" : "MDC"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mdc">MDC</SelectItem>
                  <SelectItem value="ton">Tonelada</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                <Input
                  type="number"
                  value={rule.price_per_mdc}
                  onChange={(e) => onUpdate(localIndex, "price_per_mdc", e.target.value)}
                  className="h-8 text-sm bg-white pl-7"
                  step="0.01" min={0}
                />
              </div>
              <button
                type="button"
                onClick={() => onRemove(localIndex)}
                className="h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground/50 hover:text-red-500 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {rules.length === 0 && (
        <div className="rounded-lg border border-dashed border-border/50 p-4 text-center">
          <p className="text-xs text-muted-foreground">Nenhuma faixa configurada</p>
        </div>
      )}

      <Button type="button" variant="outline" size="sm" onClick={onAdd} className="text-xs">
        <Plus className="mr-1 h-3 w-3" /> Adicionar faixa
      </Button>
    </div>
  )
}
