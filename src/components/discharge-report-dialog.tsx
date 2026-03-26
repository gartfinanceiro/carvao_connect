"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, FileText } from "lucide-react"
import { toast } from "sonner"
import { generateDischargeReport } from "@/lib/generate-discharge-report"
import type { ReportDischarge, ReportOptions } from "@/lib/generate-discharge-report"
import type { VolumeUnit } from "@/lib/utils"
import { UnitToggle } from "@/components/unit-toggle"

interface DischargeReportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type PeriodPreset = "today" | "7days" | "30days" | "custom"

interface SupplierOption {
  id: string
  name: string
}

function getDateRange(preset: PeriodPreset, customStart: string, customEnd: string) {
  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)

  switch (preset) {
    case "today":
      return { start: todayStr, end: todayStr, label: `Hoje (${formatBR(todayStr)})` }
    case "7days": {
      const start = new Date(now)
      start.setDate(start.getDate() - 7)
      const startStr = start.toISOString().slice(0, 10)
      return { start: startStr, end: todayStr, label: `Últimos 7 dias (${formatBR(startStr)} a ${formatBR(todayStr)})` }
    }
    case "30days": {
      const start = new Date(now)
      start.setDate(start.getDate() - 30)
      const startStr = start.toISOString().slice(0, 10)
      return { start: startStr, end: todayStr, label: `Últimos 30 dias (${formatBR(startStr)} a ${formatBR(todayStr)})` }
    }
    case "custom":
      return { start: customStart, end: customEnd, label: `${formatBR(customStart)} a ${formatBR(customEnd)}` }
  }
}

function formatBR(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00")
  return d.toLocaleDateString("pt-BR")
}

export function DischargeReportDialog({ open, onOpenChange }: DischargeReportDialogProps) {
  const [period, setPeriod] = useState<PeriodPreset>("7days")
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().slice(0, 10)
  })
  const [customEnd, setCustomEnd] = useState(() => new Date().toISOString().slice(0, 10))
  const [supplierFilter, setSupplierFilter] = useState("all")
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([])
  const [loadingSuppliers, setLoadingSuppliers] = useState(false)
  const [generating, setGenerating] = useState(false)

  // Column toggles
  const [colMoisture, setColMoisture] = useState(true)
  const [colFines, setColFines] = useState(true)
  const [colDeductions, setColDeductions] = useState(true)
  const [colPlate, setColPlate] = useState(false)
  const [colInvoice, setColInvoice] = useState(false)
  const [colForestGuide, setColForestGuide] = useState(false)

  // Options
  const [includeSummary, setIncludeSummary] = useState(true)
  const [groupBySupplier, setGroupBySupplier] = useState(false)
  const [reportUnit, setReportUnit] = useState<VolumeUnit>("mdc")

  const fetchSuppliers = useCallback(async () => {
    setLoadingSuppliers(true)
    const supabase = createClient()
    const { data } = await supabase
      .from("suppliers")
      .select("id, name")
      .eq("status", "ativo")
      .order("name")
    if (data) setSuppliers(data)
    setLoadingSuppliers(false)
  }, [])

  useEffect(() => {
    if (open) fetchSuppliers()
  }, [open, fetchSuppliers])

  async function handleGenerate() {
    setGenerating(true)

    try {
      const supabase = createClient()
      const dateRange = getDateRange(period, customStart, customEnd)

      // Get organization name
      const { data: { user } } = await supabase.auth.getUser()
      let orgName = ""
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("organization_id")
          .eq("id", user.id)
          .single()
        if (profile) {
          const { data: org } = await supabase
            .from("organizations")
            .select("name")
            .eq("id", profile.organization_id)
            .single()
          orgName = org?.name ?? ""
        }
      }

      // Fetch discharges
      let query = supabase
        .from("discharges")
        .select("*, supplier:suppliers(name)")
        .gte("discharge_date", dateRange.start)
        .lte("discharge_date", dateRange.end)
        .order("discharge_date", { ascending: true })

      if (supplierFilter !== "all") {
        query = query.eq("supplier_id", supplierFilter)
      }

      const { data, error } = await query

      if (error) {
        toast.error("Erro ao buscar dados para o relatório.")
        setGenerating(false)
        return
      }

      if (!data || data.length === 0) {
        toast.error("Nenhuma descarga encontrada no período selecionado.")
        setGenerating(false)
        return
      }

      const selectedSupplier = supplierFilter !== "all"
        ? suppliers.find(s => s.id === supplierFilter)?.name ?? null
        : null

      const options: ReportOptions = {
        period: dateRange,
        supplierFilter: supplierFilter !== "all" ? supplierFilter : null,
        supplierName: selectedSupplier,
        columns: {
          moisture: colMoisture,
          fines: colFines,
          deductions: colDeductions,
          plate: colPlate,
          invoice: colInvoice,
          forestGuide: colForestGuide,
        },
        includeSummary,
        groupBySupplier,
        organizationName: orgName,
        unit: reportUnit,
      }

      generateDischargeReport(data as ReportDischarge[], options)
      toast.success("Relatório gerado com sucesso!")
      onOpenChange(false)
    } catch {
      toast.error("Erro ao gerar relatório.")
    } finally {
      setGenerating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Gerar relatório de descargas
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Period */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Período</Label>
            <div className="grid grid-cols-2 gap-2">
              {([
                ["today", "Hoje"],
                ["7days", "Últimos 7 dias"],
                ["30days", "Últimos 30 dias"],
                ["custom", "Personalizado"],
              ] as [PeriodPreset, string][]).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPeriod(value)}
                  className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                    period === value
                      ? "bg-[#1B4332] text-white border-[#1B4332]"
                      : "bg-white text-foreground border-border hover:bg-muted/50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {period === "custom" && (
              <div className="flex items-center gap-2 mt-2">
                <Input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="flex-1"
                />
                <span className="text-sm text-muted-foreground">a</span>
                <Input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="flex-1"
                />
              </div>
            )}
          </div>

          {/* Supplier */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Fornecedor</Label>
            <Select
              value={supplierFilter}
              onValueChange={(v) => setSupplierFilter(v ?? "all")}
              disabled={loadingSuppliers}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos os fornecedores">
                  {(value: string) => {
                    if (value === "all") return "Todos os fornecedores"
                    return suppliers.find(s => s.id === value)?.name ?? value
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os fornecedores</SelectItem>
                {suppliers.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="border-t" />

          {/* Column toggles */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Dados do relatório</Label>
            <div className="space-y-1.5">
              <CheckboxItem label="Valor bruto / Valor líquido" checked disabled />
              <CheckboxItem label="Umidade (%)" checked={colMoisture} onChange={setColMoisture} />
              <CheckboxItem label="Impurezas (%)" checked={colFines} onChange={setColFines} />
              <CheckboxItem label="Descontos (R$)" checked={colDeductions} onChange={setColDeductions} />
              <CheckboxItem label="Placa do caminhão" checked={colPlate} onChange={setColPlate} />
              <CheckboxItem label="Nota fiscal" checked={colInvoice} onChange={setColInvoice} />
              <CheckboxItem label="Guia florestal" checked={colForestGuide} onChange={setColForestGuide} />
            </div>
          </div>

          <div className="border-t" />

          {/* Options */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Incluir no relatório</Label>
            <div className="space-y-1.5">
              <CheckboxItem label="Resumo (KPIs consolidados no topo)" checked={includeSummary} onChange={setIncludeSummary} />
              <CheckboxItem label="Agrupar por fornecedor" checked={groupBySupplier} onChange={setGroupBySupplier} />
            </div>
          </div>

          {/* Unit */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Unidade de volume</Label>
            <UnitToggle unit={reportUnit} onChange={setReportUnit} />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              className="bg-[#1B4332] hover:bg-[#2D6A4F]"
              onClick={handleGenerate}
              disabled={generating}
            >
              {generating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Gerar PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function CheckboxItem({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string
  checked: boolean
  onChange?: (checked: boolean) => void
  disabled?: boolean
}) {
  return (
    <label className={`flex items-center gap-2.5 py-1 ${disabled ? "opacity-60" : "cursor-pointer"}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange?.(e.target.checked)}
        disabled={disabled}
        className="h-4 w-4 rounded border-border text-[#1B4332] accent-[#1B4332]"
      />
      <span className="text-sm">{label}</span>
    </label>
  )
}
