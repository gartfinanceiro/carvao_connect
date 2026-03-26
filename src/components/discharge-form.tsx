"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, Truck } from "lucide-react"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/utils"
import { calculateMoistureWeightDeduction, calculateImpurityDeduction, calculateAdjustedDensity, findPriceByDensity, DEFAULT_POLICY } from "@/lib/discount-calculator"
import type { DiscountPolicy, PersonType, PricingUnit } from "@/types/database"

interface DischargeFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  supplierId?: string
  interactionId?: string
  onSuccess: () => void
}

interface SupplierOption {
  id: string
  name: string
  person_type?: PersonType
}

interface FormData {
  supplier_id: string
  discharge_date: string
  volume_mdc: string
  price_per_mdc: string
  truck_plate: string
  invoice_number: string
  forest_guide: string
  gross_weight_kg: string
  tare_weight_kg: string
  net_weight_kg: string
  moisture_percent: string
  fines_kg: string
  deductions: string
  funrural_percent: string
  notes: string
}

function getToday(): string {
  return new Date().toISOString().slice(0, 10)
}

function getInitialFormData(supplierId?: string): FormData {
  return {
    supplier_id: supplierId ?? "",
    discharge_date: getToday(),
    volume_mdc: "",
    price_per_mdc: "",
    truck_plate: "",
    invoice_number: "",
    forest_guide: "",
    gross_weight_kg: "",
    tare_weight_kg: "",
    net_weight_kg: "",
    moisture_percent: "0",
    fines_kg: "0",
    deductions: "0",
    funrural_percent: "0",
    notes: "",
  }
}

export function DischargeForm({
  open,
  onOpenChange,
  supplierId,
  interactionId,
  onSuccess,
}: DischargeFormProps) {
  const [form, setForm] = useState<FormData>(getInitialFormData(supplierId))
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({})
  const [loading, setLoading] = useState(false)
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([])
  const [loadingSuppliers, setLoadingSuppliers] = useState(false)
  const [discountPolicy, setDiscountPolicy] = useState<DiscountPolicy | null>(null)

  const fetchSuppliers = useCallback(async () => {
    setLoadingSuppliers(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from("suppliers")
      .select("id, name, person_type")
      .eq("status", "ativo")
      .order("name")

    if (!error && data) {
      setSuppliers(data)
    }
    setLoadingSuppliers(false)
  }, [])

  const fetchDiscountPolicy = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from("discount_policies")
      .select("*")
      .eq("is_active", true)
      .maybeSingle()

    if (data) {
      setDiscountPolicy(data as DiscountPolicy)
    }
  }, [])

  useEffect(() => {
    if (open) {
      fetchSuppliers()
      fetchDiscountPolicy()
      setPriceSuggested(false)
      setLastPriceSuggestion(null)
    }
  }, [open, fetchSuppliers, fetchDiscountPolicy])

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setForm(getInitialFormData(supplierId))
      setErrors({})
    }
    onOpenChange(nextOpen)
  }

  function updateField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value }

      // Auto-calculate net weight when gross and tare change
      if (key === "gross_weight_kg" || key === "tare_weight_kg") {
        const gross = key === "gross_weight_kg" ? Number(value) : Number(prev.gross_weight_kg)
        const tare = key === "tare_weight_kg" ? Number(value) : Number(prev.tare_weight_kg)
        if (gross > 0 && tare > 0) {
          next.net_weight_kg = String(gross - tare)
        }
      }

      return next
    })
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  // ── Computed values ──────────────────────────────────────────────
  const policy = discountPolicy || DEFAULT_POLICY

  const netWeight = useMemo(() => {
    const val = Number(form.net_weight_kg)
    return val > 0 ? val : null
  }, [form.net_weight_kg])

  const volume = useMemo(() => {
    const val = Number(form.volume_mdc)
    return val > 0 ? val : null
  }, [form.volume_mdc])

  const finesKg = useMemo(() => {
    return Number(form.fines_kg) || 0
  }, [form.fines_kg])

  const moisturePercent = useMemo(() => {
    return Number(form.moisture_percent) || 0
  }, [form.moisture_percent])

  // Desconto de umidade no peso (kg)
  const moistureDeduction = useMemo(() => {
    if (!netWeight) return { deductionKg: 0, rule: null }
    return calculateMoistureWeightDeduction(moisturePercent, netWeight, policy.moisture_rules)
  }, [netWeight, moisturePercent, policy.moisture_rules])

  const grossWeight = useMemo(() => {
    const val = Number(form.gross_weight_kg)
    return val > 0 ? val : null
  }, [form.gross_weight_kg])

  // Impurity deduction with tolerance
  const impurityResult = useMemo(() => {
    if (!netWeight || finesKg <= 0) return null
    return calculateImpurityDeduction(
      finesKg,
      grossWeight || netWeight,
      netWeight,
      policy.impurity_tolerance_percent ?? 0,
      policy.impurity_discount_on ?? "net"
    )
  }, [finesKg, grossWeight, netWeight, policy.impurity_tolerance_percent, policy.impurity_discount_on])

  const effectiveFinesKg = impurityResult?.deductionKg ?? finesKg

  // Peso ajustado = líquido - umidade - impurezas (com tolerância)
  const adjustedWeight = useMemo(() => {
    if (!netWeight) return null
    const adj = netWeight - moistureDeduction.deductionKg - effectiveFinesKg
    return adj > 0 ? Math.round(adj * 100) / 100 : null
  }, [netWeight, moistureDeduction.deductionKg, effectiveFinesKg])

  // Densidade ajustada = peso ajustado / volume
  const density = useMemo(() => {
    if (netWeight && volume && volume > 0) {
      return calculateAdjustedDensity(netWeight, effectiveFinesKg, volume, moistureDeduction.deductionKg)
    }
    return null
  }, [netWeight, volume, effectiveFinesKg, moistureDeduction.deductionKg])

  const selectedSupplier = useMemo(() => {
    return suppliers.find((s) => s.id === form.supplier_id) ?? null
  }, [suppliers, form.supplier_id])

  const supplierLabel = selectedSupplier?.name ?? ""
  const supplierPersonType = selectedSupplier?.person_type

  const price = useMemo(() => {
    const val = Number(form.price_per_mdc)
    return val > 0 ? val : null
  }, [form.price_per_mdc])

  // Auto-suggest price based on density
  const [priceSuggested, setPriceSuggested] = useState(false)
  const [lastPriceSuggestion, setLastPriceSuggestion] = useState<number | null>(null)
  const [pricingUnit, setPricingUnit] = useState<PricingUnit>("mdc")

  useEffect(() => {
    if (!discountPolicy || !density || density <= 0) return
    const rules = discountPolicy.density_pricing_rules || []
    if (rules.length === 0) return

    const lookup = findPriceByDensity(rules, density, supplierPersonType)
    if (!lookup) return

    setPricingUnit(lookup.pricingUnit)

    const currentPrice = Number(form.price_per_mdc) || 0
    if (currentPrice === 0 || currentPrice === lastPriceSuggestion) {
      setForm(prev => ({ ...prev, price_per_mdc: String(lookup.price) }))
      setLastPriceSuggestion(lookup.price)
      setPriceSuggested(true)
    }
  }, [density, discountPolicy, supplierPersonType]) // eslint-disable-line react-hooks/exhaustive-deps

  const grossTotal = useMemo(() => {
    if (!price) return null
    if (pricingUnit === "ton" && adjustedWeight && adjustedWeight > 0) {
      return Math.round((adjustedWeight / 1000) * price * 100) / 100
    }
    if (volume) {
      return Math.round(volume * price * 100) / 100
    }
    return null
  }, [volume, price, pricingUnit, adjustedWeight])

  const deductions = useMemo(() => {
    const val = Number(form.deductions)
    return val >= 0 ? val : 0
  }, [form.deductions])

  const netTotal = useMemo(() => {
    if (grossTotal !== null) {
      return Math.round((grossTotal - deductions) * 100) / 100
    }
    return null
  }, [grossTotal, deductions])

  const funruralPercent = useMemo(() => {
    return Number(form.funrural_percent) || 0
  }, [form.funrural_percent])

  const funruralValue = useMemo(() => {
    if (netTotal && funruralPercent > 0) {
      return Math.round(netTotal * (funruralPercent / 100) * 100) / 100
    }
    return 0
  }, [netTotal, funruralPercent])

  function validate(): boolean {
    const newErrors: Partial<Record<keyof FormData, string>> = {}

    if (!form.supplier_id) newErrors.supplier_id = "Fornecedor é obrigatório"
    if (!form.discharge_date) newErrors.discharge_date = "Data é obrigatória"

    if (!form.volume_mdc) {
      newErrors.volume_mdc = "Volume é obrigatório"
    } else if (Number(form.volume_mdc) <= 0) {
      newErrors.volume_mdc = "Volume deve ser maior que 0"
    }

    if (!form.price_per_mdc) {
      newErrors.price_per_mdc = "Preço é obrigatório"
    } else if (Number(form.price_per_mdc) <= 0) {
      newErrors.price_per_mdc = "Preço deve ser maior que 0"
    }

    const gross = form.gross_weight_kg ? Number(form.gross_weight_kg) : null
    const tare = form.tare_weight_kg ? Number(form.tare_weight_kg) : null

    if ((gross && !tare) || (!gross && tare)) {
      if (!gross) newErrors.gross_weight_kg = "Informe o peso bruto junto com a tara"
      if (!tare) newErrors.tare_weight_kg = "Informe a tara junto com o peso bruto"
    }

    if (gross && tare && gross - tare < 0) {
      newErrors.tare_weight_kg = "Tara não pode ser maior que o peso bruto"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setLoading(true)
    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const payload = {
      supplier_id: form.supplier_id,
      interaction_id: interactionId ?? null,
      discharge_date: form.discharge_date,
      volume_mdc: Number(form.volume_mdc),
      price_per_mdc: Number(form.price_per_mdc),
      truck_plate: form.truck_plate.trim() || null,
      invoice_number: form.invoice_number.trim() || null,
      forest_guide: form.forest_guide.trim() || null,
      gross_weight_kg: form.gross_weight_kg ? Number(form.gross_weight_kg) : null,
      tare_weight_kg: form.tare_weight_kg ? Number(form.tare_weight_kg) : null,
      net_weight_kg: form.net_weight_kg ? Number(form.net_weight_kg) : null,
      moisture_percent: Number(form.moisture_percent) || 0,
      fines_kg: Number(form.fines_kg) || 0,
      deductions: Number(form.deductions) || 0,
      funrural_percent: Number(form.funrural_percent) || 0,
      funrural_value: funruralValue,
      pricing_unit: pricingUnit,
      notes: form.notes.trim() || null,
      created_by: user?.id ?? null,
    }

    const { error } = await supabase.from("discharges").insert(payload)

    if (error) {
      console.error("Erro ao registrar descarga:", error)
      toast.error("Erro ao registrar descarga.")
      setLoading(false)
      return
    }

    toast.success("Descarga registrada com sucesso!")
    setLoading(false)
    onOpenChange(false)
    onSuccess()
  }

  // Has any weight deduction?
  const hasWeightDeductions = moistureDeduction.deductionKg > 0 || effectiveFinesKg > 0

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl lg:max-w-3xl xl:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Registrar descarga
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Column 1 — Dados da descarga */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Fornecedor *</Label>
                {supplierId ? (
                  <Input
                    value={supplierLabel || "Carregando..."}
                    disabled
                    className="bg-muted"
                  />
                ) : (
                  <Select
                    value={form.supplier_id}
                    onValueChange={(v) => updateField("supplier_id", v ?? "")}
                    disabled={loadingSuppliers}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione o fornecedor">
                        {(value: string) => {
                          if (!value) return "Selecione o fornecedor"
                          const s = suppliers.find((s) => s.id === value)
                          return s?.name ?? value
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {errors.supplier_id && (
                  <p className="text-xs text-destructive">{errors.supplier_id}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="discharge_date">Data da descarga *</Label>
                <Input
                  id="discharge_date"
                  type="date"
                  value={form.discharge_date}
                  onChange={(e) => updateField("discharge_date", e.target.value)}
                />
                {errors.discharge_date && (
                  <p className="text-xs text-destructive">{errors.discharge_date}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="volume_mdc">Volume (MDC) *</Label>
                <Input
                  id="volume_mdc"
                  type="number"
                  value={form.volume_mdc}
                  onChange={(e) => updateField("volume_mdc", e.target.value)}
                  placeholder="ex: 121"
                  step="0.01"
                  min={0}
                />
                {errors.volume_mdc && (
                  <p className="text-xs text-destructive">{errors.volume_mdc}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="price_per_mdc">
                  Preço (R$/{pricingUnit === "ton" ? "ton" : "MDC"}) *
                  {pricingUnit === "ton" && (
                    <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">TON</span>
                  )}
                </Label>
                <Input
                  id="price_per_mdc"
                  type="number"
                  value={form.price_per_mdc}
                  onChange={(e) => updateField("price_per_mdc", e.target.value)}
                  placeholder={pricingUnit === "ton" ? "ex: 1300.00" : "ex: 290.00"}
                  step="0.01"
                  min={0}
                />
                {errors.price_per_mdc && (
                  <p className="text-xs text-destructive">{errors.price_per_mdc}</p>
                )}
                {priceSuggested && density && Number(form.price_per_mdc) === lastPriceSuggestion && (
                  <p className="text-xs text-purple-600">
                    Preço sugerido pela densidade {density.toFixed(0)} kg/MDC
                    {supplierPersonType ? ` (${supplierPersonType.toUpperCase()})` : ""}
                    {pricingUnit === "ton" ? " — por tonelada" : ""}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="truck_plate">Placa do caminhao</Label>
                <Input
                  id="truck_plate"
                  value={form.truck_plate}
                  onChange={(e) => updateField("truck_plate", e.target.value.toUpperCase())}
                  placeholder="ex: HCF9J69"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="invoice_number">No Nota Fiscal</Label>
                <Input
                  id="invoice_number"
                  value={form.invoice_number}
                  onChange={(e) => updateField("invoice_number", e.target.value)}
                  placeholder="ex: 001/91"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="forest_guide">Guia Florestal</Label>
                <Input
                  id="forest_guide"
                  value={form.forest_guide}
                  onChange={(e) => updateField("forest_guide", e.target.value)}
                  placeholder="ex: GCA/8840911"
                />
              </div>
            </div>

            {/* Column 2 — Pesagem e qualidade */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="gross_weight_kg">Peso bruto (kg)</Label>
                <Input
                  id="gross_weight_kg"
                  type="number"
                  value={form.gross_weight_kg}
                  onChange={(e) => updateField("gross_weight_kg", e.target.value)}
                  placeholder="ex: 49270"
                  step="0.01"
                  min={0}
                />
                {errors.gross_weight_kg && (
                  <p className="text-xs text-destructive">{errors.gross_weight_kg}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="tare_weight_kg">Tara (kg)</Label>
                <Input
                  id="tare_weight_kg"
                  type="number"
                  value={form.tare_weight_kg}
                  onChange={(e) => updateField("tare_weight_kg", e.target.value)}
                  placeholder="ex: 18440"
                  step="0.01"
                  min={0}
                />
                {errors.tare_weight_kg && (
                  <p className="text-xs text-destructive">{errors.tare_weight_kg}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="moisture_percent">Umidade (%)</Label>
                <Input
                  id="moisture_percent"
                  type="number"
                  value={form.moisture_percent}
                  onChange={(e) => updateField("moisture_percent", e.target.value)}
                  placeholder="ex: 14.3"
                  step="0.01"
                  min={0}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fines_kg">Impurezas (kg)</Label>
                <Input
                  id="fines_kg"
                  type="number"
                  value={form.fines_kg}
                  onChange={(e) => updateField("fines_kg", e.target.value)}
                  placeholder="ex: 1500"
                  step="0.01"
                  min={0}
                />
              </div>

              {/* ── Breakdown de peso ──────────────────────────── */}
              {netWeight && (
                <Card className="bg-slate-50/80 border-slate-200/60">
                  <CardContent className="pt-3 pb-3 space-y-1.5">
                    <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Cálculo de peso</h4>
                    <div className="text-xs space-y-1">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Peso líquido</span>
                        <span className="font-medium">{netWeight.toLocaleString("pt-BR")} kg</span>
                      </div>
                      {moistureDeduction.deductionKg > 0 && (
                        <div className="flex justify-between text-amber-700">
                          <span>Desc. umidade ({moisturePercent}% {moistureDeduction.rule?.type === "excess" ? "excedente" : "total"})</span>
                          <span className="font-medium">-{moistureDeduction.deductionKg.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kg</span>
                        </div>
                      )}
                      {finesKg > 0 && impurityResult && (
                        impurityResult.withinTolerance ? (
                          <div className="flex justify-between text-emerald-700">
                            <span>Desc. impurezas ({impurityResult.finesPercent.toFixed(1)}% — tolerância {impurityResult.tolerancePercent}%)</span>
                            <span className="font-medium">0 kg</span>
                          </div>
                        ) : (
                          <div className="flex justify-between text-amber-700">
                            <span>Desc. impurezas{impurityResult.tolerancePercent > 0 ? ` (${impurityResult.finesPercent.toFixed(1)}% — acima de ${impurityResult.tolerancePercent}%)` : ""}</span>
                            <span className="font-medium">-{finesKg.toLocaleString("pt-BR")} kg</span>
                          </div>
                        )
                      )}
                      {finesKg > 0 && !impurityResult && (
                        <div className="flex justify-between text-amber-700">
                          <span>Desc. impurezas</span>
                          <span className="font-medium">-{finesKg.toLocaleString("pt-BR")} kg</span>
                        </div>
                      )}
                      {hasWeightDeductions && adjustedWeight && (
                        <div className="flex justify-between pt-1 border-t border-slate-200/80 font-semibold">
                          <span>Peso ajustado</span>
                          <span>{adjustedWeight.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kg</span>
                        </div>
                      )}
                      {density !== null && (
                        <div className="flex justify-between pt-1 border-t border-slate-200/80">
                          <span className="text-muted-foreground">Densidade ajustada</span>
                          <span className="font-semibold text-[#1B4332]">{density.toFixed(2)} kg/MDC</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* Financial summary */}
          <Card className="bg-muted/50">
            <CardContent className="pt-4 pb-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Resumo financeiro
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Valor bruto</span>
                  <span className="font-medium">
                    {grossTotal !== null ? formatCurrency(grossTotal) : "—"}
                  </span>
                </div>
                {grossTotal !== null && price && (
                  <p className="text-xs text-muted-foreground">
                    {pricingUnit === "ton" && adjustedWeight
                      ? `${(adjustedWeight / 1000).toFixed(2)} ton x ${formatCurrency(price)}/ton`
                      : volume ? `${volume} MDC x ${formatCurrency(price)}/MDC` : ""}
                  </p>
                )}
                <div className="flex items-center justify-between text-sm gap-4">
                  <span className="text-muted-foreground">Descontos adicionais (R$)</span>
                  <Input
                    type="number"
                    value={form.deductions}
                    onChange={(e) => updateField("deductions", e.target.value)}
                    className="w-32 text-right"
                    step="0.01"
                    min={0}
                  />
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="font-semibold text-[#333]">Valor líquido</span>
                  <span className="text-lg font-bold text-[#333]">
                    {netTotal !== null ? formatCurrency(netTotal) : "—"}
                  </span>
                </div>

                {/* FUNRURAL checkbox */}
                <div className="pt-2 border-t border-dashed border-border/60">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={funruralPercent > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setForm(prev => ({ ...prev, funrural_percent: "1.5" }))
                        } else {
                          setForm(prev => ({ ...prev, funrural_percent: "0" }))
                        }
                      }}
                      className="h-4 w-4 rounded border-gray-300 text-[#1B4332] focus:ring-[#1B4332] cursor-pointer"
                    />
                    <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">FUNRURAL</span>
                  </label>
                  {funruralPercent > 0 && (
                    <div className="mt-2 ml-6 space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-1.5">
                          <span className="text-muted-foreground">Alíquota</span>
                          <Input
                            type="number"
                            value={form.funrural_percent}
                            onChange={(e) => updateField("funrural_percent", e.target.value)}
                            className="w-16 h-7 text-xs text-right"
                            step="0.1" min={0}
                          />
                          <span className="text-xs text-muted-foreground">%</span>
                        </div>
                        <span className="font-medium text-red-600">
                          {funruralValue > 0 ? `-${formatCurrency(funruralValue)}` : "—"}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Valor a pagar (final) */}
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="font-semibold text-[#1B4332]">Valor a pagar</span>
                  <span className="text-xl font-bold text-[#1B4332]">
                    {netTotal !== null
                      ? formatCurrency(netTotal - funruralValue)
                      : "—"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="discharge_notes">Observacoes</Label>
            <Textarea
              id="discharge_notes"
              value={form.notes}
              onChange={(e) => updateField("notes", e.target.value)}
              placeholder="Observacoes sobre a descarga..."
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-[#1B4332] hover:bg-[#2D6A4F]"
              disabled={loading}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Registrar descarga
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
