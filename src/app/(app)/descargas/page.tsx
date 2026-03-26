"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
import {
  Plus,
  Search,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  FileText,
  Pencil,
  Trash2,
  Printer,
  Loader2,
} from "lucide-react"
import { toast } from "sonner"
import { charcoalTypeLabels } from "@/lib/labels"
import { formatCurrency, convertVolume, convertPrice, unitLabel, priceUnitLabel } from "@/lib/utils"
import type { VolumeUnit } from "@/lib/utils"
import { UnitToggle } from "@/components/unit-toggle"
import { DischargeForm } from "@/components/discharge-form"
import { DischargeReportDialog } from "@/components/discharge-report-dialog"
import { AccessGate } from "@/components/access-gate"
import { useSubscription } from "@/components/subscription-provider"
import { generateDischargeTicket } from "@/lib/generate-discharge-ticket"
import type { DischargeTicketData } from "@/lib/generate-discharge-ticket"
import { logActivity } from "@/lib/activity-logger"
import type { Discharge, CharcoalType } from "@/types/database"

const PAGE_SIZE = 20

function getDefaultDateRange(): { start: string; end: string } {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - 30)
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  }
}

function formatDateBR(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00")
  return d.toLocaleDateString("pt-BR")
}

function DensityText({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground">—</span>
  if (value >= 230) {
    return <span className="text-sm tabular-nums text-emerald-600 font-medium">{value}</span>
  }
  if (value >= 200) {
    return <span className="text-sm tabular-nums text-foreground">{value}</span>
  }
  return <span className="text-sm tabular-nums text-amber-600 font-medium">{value}</span>
}

type DischargeWithSupplier = Discharge & {
  supplier: { name: string }
  creator: { name: string } | null
}

export default function DescargasPage() {
  return (
    <AccessGate module="descargas">
      <DescargasContent />
    </AccessGate>
  )
}

function DescargasContent() {
  const { canSeeFinancials, hasAccess, isAdmin } = useSubscription()
  const showReports = hasAccess("relatorios")
  const defaultRange = useMemo(() => getDefaultDateRange(), [])

  const [discharges, setDischarges] = useState<DischargeWithSupplier[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [sortColumn, setSortColumn] = useState("discharge_date")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Filters
  const [search, setSearch] = useState("")
  const [startDate, setStartDate] = useState(defaultRange.start)
  const [endDate, setEndDate] = useState(defaultRange.end)
  const [charcoalType, setCharcoalType] = useState("all")

  // Unit toggle
  const [unit, setUnit] = useState<VolumeUnit>("mdc")

  // Form dialog
  const [formOpen, setFormOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [editDischarge, setEditDischarge] = useState<DischargeWithSupplier | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DischargeWithSupplier | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Summary
  const [summary, setSummary] = useState({
    totalVolume: 0,
    avgDensity: null as number | null,
    avgPrice: null as number | null,
    totalPaid: 0,
    rawData: [] as { volume_mdc: number; density_kg_mdc: number | null; price_per_mdc: number | null }[],
  })

  const fetchDischarges = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    let countQuery = supabase
      .from("discharges")
      .select("*", { count: "exact", head: true })
      .gte("discharge_date", startDate)
      .lte("discharge_date", endDate)

    let dataQuery = supabase
      .from("discharges")
      .select("*, supplier:suppliers(name), creator:profiles!created_by(name)", { count: "exact" })
      .gte("discharge_date", startDate)
      .lte("discharge_date", endDate)

    // Charcoal type filter via supplier join
    if (charcoalType !== "all") {
      countQuery = countQuery.eq("charcoal_type", charcoalType)
      dataQuery = dataQuery.eq("charcoal_type", charcoalType)
    }

    // Sort
    const ascending = sortDirection === "asc"
    dataQuery = dataQuery.order(sortColumn, { ascending, nullsFirst: false })

    // Pagination
    const from = (page - 1) * PAGE_SIZE
    const to = from + PAGE_SIZE - 1
    dataQuery = dataQuery.range(from, to)

    const [{ count }, { data, error }] = await Promise.all([
      countQuery,
      dataQuery,
    ])

    if (!error && data) {
      // Filter client-side by search (name or plate)
      let filtered = data as DischargeWithSupplier[]
      if (search.trim()) {
        const term = search.toLowerCase()
        filtered = filtered.filter(
          (d) =>
            d.supplier?.name?.toLowerCase().includes(term) ||
            d.truck_plate?.toLowerCase().includes(term)
        )
      }
      setDischarges(filtered)
      setTotalCount(search.trim() ? filtered.length : (count ?? 0))
    } else {
      setDischarges([])
      setTotalCount(0)
    }
    setLoading(false)
  }, [startDate, endDate, charcoalType, sortColumn, sortDirection, page, search])

  const fetchSummary = useCallback(async () => {
    const supabase = createClient()

    let query = supabase
      .from("discharges")
      .select("volume_mdc, density_kg_mdc, price_per_mdc, net_total")
      .gte("discharge_date", startDate)
      .lte("discharge_date", endDate)

    if (charcoalType !== "all") {
      query = query.eq("charcoal_type", charcoalType)
    }

    const { data, error } = await query

    if (!error && data) {
      const totalVolume = data.reduce((sum, d) => sum + Number(d.volume_mdc), 0)
      const densities = data
        .map((d) => d.density_kg_mdc)
        .filter((d): d is number => d !== null)
      const avgDensity =
        densities.length > 0
          ? Math.round(densities.reduce((a, b) => a + b, 0) / densities.length)
          : null
      const prices = data.map((d) => Number(d.price_per_mdc))
      const avgPrice =
        prices.length > 0
          ? Math.round((prices.reduce((a, b) => a + b, 0) / prices.length) * 100) / 100
          : null
      const totalPaid = data.reduce((sum, d) => sum + Number(d.net_total ?? 0), 0)
      setSummary({
        totalVolume,
        avgDensity,
        avgPrice,
        totalPaid,
        rawData: data.map(d => ({
          volume_mdc: Number(d.volume_mdc),
          density_kg_mdc: d.density_kg_mdc,
          price_per_mdc: d.price_per_mdc ? Number(d.price_per_mdc) : null,
        })),
      })
    }
  }, [startDate, endDate, charcoalType])

  useEffect(() => {
    fetchDischarges()
  }, [fetchDischarges])

  useEffect(() => {
    fetchSummary()
  }, [fetchSummary])

  // Converted KPI values (per-discharge conversion then sum)
  const kpiVolume = useMemo(() => {
    if (unit === "mdc") return summary.totalVolume
    return summary.rawData.reduce(
      (sum, d) => sum + convertVolume(d.volume_mdc, d.density_kg_mdc, unit),
      0,
    )
  }, [unit, summary])

  const kpiAvgPrice = useMemo(() => {
    if (unit === "mdc") return summary.avgPrice
    const converted = summary.rawData
      .map(d => convertPrice(d.price_per_mdc, d.density_kg_mdc, unit))
      .filter((p): p is number => p !== null)
    if (converted.length === 0) return null
    return Math.round((converted.reduce((a, b) => a + b, 0) / converted.length) * 100) / 100
  }, [unit, summary])

  // Reset page on filter change
  useEffect(() => {
    setPage(1)
  }, [search, startDate, endDate, charcoalType])

  function handleSort(column: string) {
    if (sortColumn === column) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortColumn(column)
      setSortDirection("desc")
    }
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  const charcoalTypeValueLabel: Record<string, string> = {
    all: "Todos os tipos",
    ...charcoalTypeLabels,
  }

  function SortableHeader({
    column,
    children,
    className,
  }: {
    column: string
    children: React.ReactNode
    className?: string
  }) {
    const isActive = sortColumn === column
    return (
      <TableHead
        className={`cursor-pointer select-none hover:bg-muted/50 text-[11px] font-medium uppercase tracking-widest text-muted-foreground ${className ?? ""}`}
        onClick={() => handleSort(column)}
      >
        <div className="flex items-center gap-1">
          {children}
          <ArrowUpDown
            className={`h-3 w-3 ${isActive ? "text-foreground" : "text-muted-foreground/50"}`}
          />
        </div>
      </TableHead>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Descargas</h1>
          <p className="text-sm text-muted-foreground">{totalCount} no período</p>
        </div>
        <div className="flex items-center gap-2">
          <UnitToggle unit={unit} onChange={setUnit} />
          {showReports && (
            <Button
              variant="outline"
              onClick={() => setReportOpen(true)}
            >
              <FileText className="mr-2 h-4 w-4" />
              Relatório
            </Button>
          )}
          <Button
            className="bg-[#1B4332] hover:bg-[#2D6A4F]"
            onClick={() => setFormOpen(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Nova descarga
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className={`grid grid-cols-2 ${canSeeFinancials ? "lg:grid-cols-4" : "lg:grid-cols-2"} gap-8`}>
        <div>
          <p className="text-xs text-muted-foreground tracking-wide">Volume no período</p>
          <p className="text-3xl font-semibold mt-0.5">
            {Math.round(kpiVolume * 10) / 10 !== 0 ? (Math.round(kpiVolume * 10) / 10).toLocaleString("pt-BR") : "0"}
          </p>
          <p className="text-xs text-muted-foreground">{unitLabel(unit)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground tracking-wide">Densidade média</p>
          <p className="text-3xl font-semibold mt-0.5">
            {summary.avgDensity !== null ? summary.avgDensity : "—"}
          </p>
          <p className="text-xs text-muted-foreground">kg/mdc</p>
        </div>
        {canSeeFinancials && (
          <div>
            <p className="text-xs text-muted-foreground tracking-wide">Preço médio</p>
            <p className="text-3xl font-semibold mt-0.5">
              {kpiAvgPrice !== null
                ? formatCurrency(kpiAvgPrice)
                : "—"}
            </p>
            <p className="text-xs text-muted-foreground">{priceUnitLabel(unit)}</p>
          </div>
        )}
        {canSeeFinancials && (
          <div>
            <p className="text-xs text-muted-foreground tracking-wide">Total pago</p>
            <p className="text-3xl font-semibold mt-0.5 text-foreground">
              {formatCurrency(summary.totalPaid)}
            </p>
          </div>
        )}
      </div>
      <div className="border-b border-black/[0.04]" />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="relative max-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Fornecedor ou placa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-[140px]"
          />
          <span className="text-sm text-muted-foreground">a</span>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-[140px]"
          />
        </div>

        <Select
          value={charcoalType}
          onValueChange={(v) => setCharcoalType(v ?? "all")}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Tipo de carvão">
              {(value: string) => charcoalTypeValueLabel[value] ?? value}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {(
              Object.entries(charcoalTypeLabels) as [CharcoalType, string][]
            ).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      ) : (
        <div>
          <div className="rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-black/[0.08]">
                  <TableHead className="w-8" />
                  <SortableHeader column="discharge_date">Data</SortableHeader>
                  <TableHead className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                    Fornecedor
                  </TableHead>
                  <SortableHeader column="volume_mdc">Volume ({unitLabel(unit)})</SortableHeader>
                  <SortableHeader column="density_kg_mdc" className="hidden sm:table-cell">
                    Densidade
                  </SortableHeader>
                  {canSeeFinancials && (
                    <SortableHeader column="price_per_mdc" className="hidden md:table-cell">
                      Preço ({priceUnitLabel(unit)})
                    </SortableHeader>
                  )}
                  <SortableHeader column="moisture_percent" className="hidden xl:table-cell">
                    Umidade
                  </SortableHeader>
                  <SortableHeader column="fines_percent" className="hidden xl:table-cell">
                    Impurezas
                  </SortableHeader>
                  {canSeeFinancials && (
                    <SortableHeader column="gross_total" className="hidden xl:table-cell">
                      Bruto
                    </SortableHeader>
                  )}
                  {canSeeFinancials && (
                    <SortableHeader column="deductions" className="hidden lg:table-cell">
                      Descontos
                    </SortableHeader>
                  )}
                  {canSeeFinancials && (
                    <SortableHeader column="net_total">Líquido</SortableHeader>
                  )}
                  <TableHead className="hidden lg:table-cell text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                    Placa
                  </TableHead>
                  <TableHead className="hidden 2xl:table-cell text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                    Registrado por
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {discharges.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={13}
                      className="h-32 text-center text-muted-foreground"
                    >
                      Nenhuma descarga encontrada no período.
                    </TableCell>
                  </TableRow>
                ) : (
                  discharges.map((d) => {
                    const isExpanded = expandedId === d.id
                    return (
                      <DischargeRow
                        key={d.id}
                        discharge={d}
                        isExpanded={isExpanded}
                        onToggle={() => setExpandedId(isExpanded ? null : d.id)}
                        unit={unit}
                        showFinancials={canSeeFinancials}
                        isAdmin={isAdmin}
                        onEdit={(disc) => { setEditDischarge(disc); setFormOpen(true) }}
                        onDelete={(disc) => setDeleteTarget(disc)}
                      />
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Mostrando {(page - 1) * PAGE_SIZE + 1}–
                {Math.min(page * PAGE_SIZE, totalCount)} de {totalCount}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">
                  {page} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Discharge Form Dialog */}
      <DischargeForm
        open={formOpen}
        onOpenChange={(open) => { setFormOpen(open); if (!open) setEditDischarge(null) }}
        editDischarge={editDischarge}
        onSuccess={() => {
          setFormOpen(false)
          setEditDischarge(null)
          fetchDischarges()
          fetchSummary()
        }}
      />

      {/* Report Dialog */}
      <DischargeReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
      />

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir descarga</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja excluir a descarga
            {deleteTarget?.discharge_number ? ` Nº ${String(deleteTarget.discharge_number).padStart(4, "0")}` : ""}
            {deleteTarget?.supplier?.name ? ` de ${deleteTarget.supplier.name}` : ""}?
            Esta ação não pode ser desfeita.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={async () => {
                if (!deleteTarget) return
                setDeleting(true)
                const supabase = createClient()
                const { data: { user } } = await supabase.auth.getUser()

                await supabase.from("interactions").update({ resolved_discharge_id: null }).eq("resolved_discharge_id", deleteTarget.id)
                await supabase.from("queue_entries").update({ discharge_id: null }).eq("discharge_id", deleteTarget.id)
                await supabase.from("activity_log").delete().eq("discharge_id", deleteTarget.id)

                const { error } = await supabase.from("discharges").delete().eq("id", deleteTarget.id)
                if (error) {
                  toast.error("Erro ao excluir descarga.")
                } else {
                  logActivity({
                    supabase,
                    eventType: "discharge_deleted",
                    userId: user?.id,
                    supplierId: deleteTarget.supplier_id,
                    title: deleteTarget.supplier?.name || "Fornecedor",
                    subtitle: `Nº ${deleteTarget.discharge_number || "—"} — ${deleteTarget.volume_mdc} MDC`,
                    metadata: { discharge_number: deleteTarget.discharge_number, volume_mdc: deleteTarget.volume_mdc },
                  })
                  toast.success("Descarga excluída.")
                  fetchDischarges()
                  fetchSummary()
                }
                setDeleting(false)
                setDeleteTarget(null)
              }}
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function DischargeRow({
  discharge: d,
  isExpanded,
  onToggle,
  unit,
  showFinancials,
  isAdmin,
  onEdit,
  onDelete,
}: {
  discharge: DischargeWithSupplier
  isExpanded: boolean
  onToggle: () => void
  unit: VolumeUnit
  showFinancials: boolean
  isAdmin: boolean
  onEdit: (d: DischargeWithSupplier) => void
  onDelete: (d: DischargeWithSupplier) => void
}) {
  const moisture = Number(d.moisture_percent)
  const finesPercent = Number(d.fines_percent)
  const deductions = Number(d.deductions)

  return (
    <>
      <TableRow
        className="cursor-pointer hover:bg-muted/20 transition-colors duration-150 [&>td]:py-3"
        onClick={onToggle}
      >
        <TableCell className="w-8 pr-0">
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </TableCell>
        <TableCell className="font-medium text-sm">
          {formatDateBR(d.discharge_date)}
        </TableCell>
        <TableCell className="text-sm">
          {d.supplier?.name ?? "—"}
        </TableCell>
        <TableCell className="text-sm tabular-nums">
          {convertVolume(d.volume_mdc, d.density_kg_mdc, unit)} {unitLabel(unit)}
        </TableCell>
        <TableCell className="hidden sm:table-cell">
          <DensityText value={d.density_kg_mdc} />
        </TableCell>
        {showFinancials && (
          <TableCell className="hidden md:table-cell text-sm tabular-nums">
            {formatCurrency(convertPrice(d.price_per_mdc, d.density_kg_mdc, unit))}
          </TableCell>
        )}
        <TableCell className={`hidden xl:table-cell text-sm tabular-nums ${moisture > 5 ? "text-amber-600 font-medium" : "text-muted-foreground"}`}>
          {moisture > 0 ? `${moisture}%` : "—"}
        </TableCell>
        <TableCell className={`hidden xl:table-cell text-sm tabular-nums ${finesPercent > 3 ? "text-amber-600 font-medium" : "text-muted-foreground"}`}>
          {finesPercent > 0 ? `${finesPercent}%` : "—"}
        </TableCell>
        {showFinancials && (
          <TableCell className="hidden xl:table-cell text-sm tabular-nums text-muted-foreground">
            {d.gross_total ? formatCurrency(d.gross_total) : "—"}
          </TableCell>
        )}
        {showFinancials && (
          <TableCell className={`hidden lg:table-cell text-sm tabular-nums ${deductions > 0 ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
            {deductions > 0 ? `-${formatCurrency(deductions)}` : "—"}
          </TableCell>
        )}
        {showFinancials && (
          <TableCell className="font-medium text-sm text-[#1B4332] tabular-nums">
            {formatCurrency(d.net_total)}
          </TableCell>
        )}
        <TableCell className="hidden lg:table-cell font-mono text-xs text-muted-foreground tracking-wider">
          {d.truck_plate || "—"}
        </TableCell>
        <TableCell className="hidden 2xl:table-cell text-sm text-muted-foreground">
          {d.creator?.name || "—"}
        </TableCell>
      </TableRow>

      {isExpanded && (
        <TableRow className="bg-muted/20 hover:bg-muted/20">
          <TableCell colSpan={13} className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Peso bruto</p>
                <p className="font-medium">
                  {d.gross_weight_kg
                    ? `${Number(d.gross_weight_kg).toLocaleString("pt-BR")} kg`
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tara</p>
                <p className="font-medium">
                  {d.tare_weight_kg
                    ? `${Number(d.tare_weight_kg).toLocaleString("pt-BR")} kg`
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Peso líquido</p>
                <p className="font-medium">
                  {d.net_weight_kg
                    ? `${Number(d.net_weight_kg).toLocaleString("pt-BR")} kg`
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Densidade</p>
                <p className="font-medium">
                  {d.density_kg_mdc ? `${d.density_kg_mdc} kg/mdc` : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Umidade</p>
                <p className={`font-medium ${moisture > 5 ? "text-amber-600" : ""}`}>
                  {moisture > 0 ? `${moisture}%` : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Impurezas</p>
                <p className={`font-medium ${finesPercent > 3 ? "text-amber-600" : ""}`}>
                  {Number(d.fines_kg) > 0
                    ? `${Number(d.fines_kg).toLocaleString("pt-BR")} kg (${finesPercent}%)`
                    : "—"}
                </p>
              </div>
              {showFinancials && (
                <div>
                  <p className="text-xs text-muted-foreground">Valor bruto</p>
                  <p className="font-medium">{d.gross_total ? formatCurrency(d.gross_total) : "—"}</p>
                </div>
              )}
              {showFinancials && (
                <div>
                  <p className="text-xs text-muted-foreground">Descontos</p>
                  <p className={`font-medium ${deductions > 0 ? "text-red-500" : ""}`}>
                    {deductions > 0 ? `-${formatCurrency(deductions)}` : "—"}
                  </p>
                </div>
              )}
              {showFinancials && (
                <div>
                  <p className="text-xs text-muted-foreground">Valor líquido</p>
                  <p className="font-medium text-[#1B4332]">{formatCurrency(d.net_total)}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground">Nota Fiscal</p>
                <p className="font-medium">{d.invoice_number || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Guia Florestal</p>
                <p className="font-medium">{d.forest_guide || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tipo de carvão</p>
                <p className="font-medium">
                  {d.charcoal_type ? charcoalTypeLabels[d.charcoal_type] ?? d.charcoal_type : "—"}
                </p>
              </div>
              {d.notes && (
                <div className="col-span-2 md:col-span-3 lg:col-span-4">
                  <p className="text-xs text-muted-foreground">Observações</p>
                  <p className="font-medium">{d.notes}</p>
                </div>
              )}
              <div className="col-span-2 md:col-span-3 lg:col-span-4 flex items-center justify-between pt-2 border-t border-border/40">
                <p className="text-xs text-muted-foreground">
                  {d.discharge_number ? `Nº ${String(d.discharge_number).padStart(4, "0")}` : ""}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1.5"
                    onClick={(e) => { e.stopPropagation(); onEdit(d) }}
                  >
                    <Pencil className="h-3 w-3" />
                    Editar
                  </Button>
                  {isAdmin && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
                      onClick={(e) => { e.stopPropagation(); onDelete(d) }}
                    >
                      <Trash2 className="h-3 w-3" />
                      Excluir
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}
