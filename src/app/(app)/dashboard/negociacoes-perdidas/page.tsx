"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ArrowLeft, Loader2, XCircle } from "lucide-react"
import { AccessGate } from "@/components/access-gate"

interface CancelledItem {
  id: string
  created_at: string
  promised_volume: number | null
  promised_date: string | null
  promised_cancel_reason: string | null
  notes: string | null
  supplier: { id: string; name: string } | null
}

interface SupplierOption {
  id: string
  name: string
}

const PERIOD_OPTIONS = [
  { value: "1m", label: "Último mês" },
  { value: "3m", label: "Últimos 3 meses" },
  { value: "6m", label: "Últimos 6 meses" },
  { value: "year", label: "Este ano" },
  { value: "all", label: "Todas" },
]

const REASON_OPTIONS = [
  { value: "all", label: "Todos os motivos" },
  { value: "Fornecedor desistiu", label: "Fornecedor desistiu" },
  { value: "Vendeu para outra siderúrgica", label: "Vendeu p/ outra siderúrgica" },
  { value: "Problema na produção/transporte", label: "Problema produção/transporte" },
  { value: "Preço não acordado", label: "Preço não acordado" },
  { value: "Outro", label: "Outro" },
]

const REASON_COLORS: Record<string, string> = {
  "Vendeu para outra siderúrgica": "bg-red-100 text-red-700",
  "Preço não acordado": "bg-amber-100 text-amber-700",
  "Fornecedor desistiu": "bg-gray-100 text-gray-700",
  "Problema na produção/transporte": "bg-orange-100 text-orange-700",
}

function getPeriodStart(period: string): string | null {
  const now = new Date()
  if (period === "all") return null
  if (period === "year") return `${now.getFullYear()}-01-01`
  const months = period === "1m" ? 1 : period === "3m" ? 3 : 6
  const d = new Date(now.getFullYear(), now.getMonth() - months, 1)
  return d.toISOString().split("T")[0]
}

function formatDateBR(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("pt-BR")
}

function parseReasonAndObs(item: CancelledItem): { reason: string; obs: string | null } {
  const raw = item.promised_cancel_reason || ""
  const reason = raw.split(". Obs:")[0] || "Sem motivo"
  const obs = raw.includes(". Obs:")
    ? raw.split(". Obs:")[1]?.trim() || null
    : item.notes || null
  return { reason, obs }
}

export default function NegociacoesPerdidas() {
  return (
    <AccessGate module="fornecedores">
      <PageContent />
    </AccessGate>
  )
}

function PageContent() {
  const [items, setItems] = useState<CancelledItem[]>([])
  const [loading, setLoading] = useState(true)
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([])

  const [period, setPeriod] = useState("1m")
  const [reasonFilter, setReasonFilter] = useState("all")
  const [supplierFilter, setSupplierFilter] = useState("all")

  const fetchSuppliers = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase.from("suppliers").select("id, name").eq("status", "ativo").order("name")
    if (data) setSuppliers(data)
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    let query = supabase
      .from("interactions")
      .select("id, created_at, promised_volume, promised_date, promised_cancel_reason, notes, supplier:suppliers(id, name)")
      .eq("promised_status", "cancelada")
      .eq("load_promised", true)
      .order("created_at", { ascending: false })

    const periodStart = getPeriodStart(period)
    if (periodStart) {
      query = query.gte("created_at", periodStart)
    }

    if (supplierFilter !== "all") {
      query = query.eq("supplier_id", supplierFilter)
    }

    const { data } = await query

    const mapped = (data ?? []).map((d) => {
      const sup = d.supplier as unknown
      const supplier = Array.isArray(sup) ? (sup[0] as { id: string; name: string } | undefined) ?? null : sup as { id: string; name: string } | null
      return { ...d, supplier } as CancelledItem
    })

    setItems(mapped)
    setLoading(false)
  }, [period, supplierFilter])

  useEffect(() => { fetchSuppliers() }, [fetchSuppliers])
  useEffect(() => { fetchData() }, [fetchData])

  const filtered = useMemo(() => {
    if (reasonFilter === "all") return items
    if (reasonFilter === "Outro") {
      const knownReasons = REASON_OPTIONS.filter(r => r.value !== "all" && r.value !== "Outro").map(r => r.value)
      return items.filter(i => {
        const r = i.promised_cancel_reason || ""
        return !knownReasons.some(kr => r.startsWith(kr))
      })
    }
    return items.filter(i => (i.promised_cancel_reason || "").startsWith(reasonFilter))
  }, [items, reasonFilter])

  const summary = useMemo(() => {
    const byReason = new Map<string, number>()
    let totalVolume = 0
    for (const item of filtered) {
      const { reason } = parseReasonAndObs(item)
      byReason.set(reason, (byReason.get(reason) || 0) + 1)
      totalVolume += item.promised_volume || 0
    }
    return { total: filtered.length, byReason, totalVolume }
  }, [filtered])

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div>
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="h-4 w-4" />
          Voltar ao Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-foreground">Negociações perdidas</h1>
        <p className="text-sm text-muted-foreground mt-1">Entenda por que cargas prometidas não foram entregues</p>
      </div>

      {/* Filters — stack on mobile, row on desktop */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Select value={period} onValueChange={(v) => v && setPeriod(v)}>
          <SelectTrigger className="w-full sm:w-[180px] h-9 text-sm">
            <SelectValue>{(v: string) => PERIOD_OPTIONS.find(o => o.value === v)?.label || v}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={reasonFilter} onValueChange={(v) => v && setReasonFilter(v)}>
          <SelectTrigger className="w-full sm:w-[240px] h-9 text-sm">
            <SelectValue>{(v: string) => REASON_OPTIONS.find(o => o.value === v)?.label || v}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {REASON_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={supplierFilter} onValueChange={(v) => v && setSupplierFilter(v)}>
          <SelectTrigger className="w-full sm:w-[220px] h-9 text-sm">
            <SelectValue>{(v: string) => v === "all" ? "Todos os fornecedores" : suppliers.find(s => s.id === v)?.name || v}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os fornecedores</SelectItem>
            {suppliers.map(s => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary — responsive layout */}
      <div className="rounded-xl border border-border bg-white p-4 md:p-5" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
          <div className="flex items-center gap-6">
            <div>
              <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wide">Total</p>
              <p className="text-2xl font-extrabold text-red-600">{summary.total}</p>
            </div>
            <div className="w-px h-10 bg-border hidden sm:block" />
            <div>
              <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wide">Volume perdido</p>
              <p className="text-2xl font-extrabold text-foreground">{summary.totalVolume} <span className="text-sm font-medium text-muted-foreground">cargas</span></p>
            </div>
          </div>
          {summary.byReason.size > 0 && (
            <>
              <div className="w-px h-10 bg-border hidden sm:block" />
              <div className="flex flex-wrap gap-1.5">
                {Array.from(summary.byReason.entries()).map(([reason, count]) => (
                  <Badge key={reason} className={`text-[11px] ${REASON_COLORS[reason] || "bg-gray-100 text-gray-700"}`}>
                    {reason}: {count}
                  </Badge>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-white p-12 text-center" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <XCircle className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhuma negociação perdida no período selecionado.</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Altere os filtros acima para ver outros períodos.</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block rounded-xl border border-border bg-white overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Data</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead className="text-center w-[80px]">Cargas</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Observações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((item) => {
                    const { reason, obs } = parseReasonAndObs(item)
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium whitespace-nowrap text-sm">
                          {formatDateBR(item.created_at)}
                        </TableCell>
                        <TableCell>
                          {item.supplier ? (
                            <Link href={`/fornecedores/${item.supplier.id}`} className="font-medium text-[#1B4332] hover:underline text-sm">
                              {item.supplier.name}
                            </Link>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-center font-medium text-sm">
                          {item.promised_volume || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge className={`text-[11px] ${REASON_COLORS[reason] || "bg-gray-100 text-gray-700"}`}>
                            {reason}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[300px]">
                          {obs ? (
                            <Tooltip>
                              <TooltipTrigger className="truncate block max-w-[300px] cursor-help text-left">
                                {obs}
                              </TooltipTrigger>
                              <TooltipContent side="bottom" className="max-w-sm text-sm">
                                {obs}
                              </TooltipContent>
                            </Tooltip>
                          ) : "—"}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((item) => {
              const { reason, obs } = parseReasonAndObs(item)
              return (
                <div key={item.id} className="rounded-xl border border-border bg-white p-4 space-y-2" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{formatDateBR(item.created_at)}</span>
                    <Badge className={`text-[10px] ${REASON_COLORS[reason] || "bg-gray-100 text-gray-700"}`}>
                      {reason}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    {item.supplier ? (
                      <Link href={`/fornecedores/${item.supplier.id}`} className="font-semibold text-[#1B4332] hover:underline text-sm">
                        {item.supplier.name}
                      </Link>
                    ) : <span className="text-sm">—</span>}
                    <span className="text-sm font-medium text-muted-foreground">{item.promised_volume || 0} carga{(item.promised_volume || 0) !== 1 ? "s" : ""}</span>
                  </div>
                  {obs && (
                    <p className="text-xs text-muted-foreground leading-relaxed">{obs}</p>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
