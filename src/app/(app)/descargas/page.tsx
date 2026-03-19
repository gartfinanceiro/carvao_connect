"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
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
  Plus,
  Search,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { charcoalTypeLabels } from "@/lib/labels"
import { formatCurrency } from "@/lib/utils"
import { DischargeForm } from "@/components/discharge-form"
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
}

export default function DescargasPage() {
  const router = useRouter()
  const defaultRange = useMemo(() => getDefaultDateRange(), [])

  const [discharges, setDischarges] = useState<DischargeWithSupplier[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [sortColumn, setSortColumn] = useState("discharge_date")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")

  // Filters
  const [search, setSearch] = useState("")
  const [startDate, setStartDate] = useState(defaultRange.start)
  const [endDate, setEndDate] = useState(defaultRange.end)
  const [charcoalType, setCharcoalType] = useState("all")

  // Form dialog
  const [formOpen, setFormOpen] = useState(false)

  // Summary
  const [summary, setSummary] = useState({
    totalVolume: 0,
    avgDensity: null as number | null,
    avgPrice: null as number | null,
    totalPaid: 0,
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
      .select("*, supplier:suppliers(name)", { count: "exact" })
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
      setSummary({ totalVolume, avgDensity, avgPrice, totalPaid })
    }
  }, [startDate, endDate, charcoalType])

  useEffect(() => {
    fetchDischarges()
  }, [fetchDischarges])

  useEffect(() => {
    fetchSummary()
  }, [fetchSummary])

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
        <Button
          className="bg-[#1B4332] hover:bg-[#2D6A4F]"
          onClick={() => setFormOpen(true)}
        >
          <Plus className="mr-2 h-4 w-4" />
          Nova descarga
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
        <div>
          <p className="text-xs text-muted-foreground tracking-wide">Volume no período</p>
          <p className="text-3xl font-semibold mt-0.5">
            {summary.totalVolume.toLocaleString("pt-BR")}
          </p>
          <p className="text-xs text-muted-foreground">MDC</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground tracking-wide">Densidade média</p>
          <p className="text-3xl font-semibold mt-0.5">
            {summary.avgDensity !== null ? summary.avgDensity : "—"}
          </p>
          <p className="text-xs text-muted-foreground">kg/mdc</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground tracking-wide">Preço médio</p>
          <p className="text-3xl font-semibold mt-0.5">
            {summary.avgPrice !== null
              ? formatCurrency(summary.avgPrice)
              : "—"}
          </p>
          <p className="text-xs text-muted-foreground">/mdc</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground tracking-wide">Total pago</p>
          <p className="text-3xl font-semibold mt-0.5 text-foreground">
            {formatCurrency(summary.totalPaid)}
          </p>
        </div>
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
            <SelectValue placeholder="Tipo de carvao">
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
                  <SortableHeader column="discharge_date">Data</SortableHeader>
                  <TableHead className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                    Fornecedor
                  </TableHead>
                  <SortableHeader column="volume_mdc">Volume</SortableHeader>
                  <SortableHeader column="density_kg_mdc" className="hidden sm:table-cell">
                    Densidade
                  </SortableHeader>
                  <SortableHeader column="price_per_mdc" className="hidden md:table-cell">
                    Preco
                  </SortableHeader>
                  <SortableHeader column="net_total">Valor</SortableHeader>
                  <TableHead className="hidden lg:table-cell text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                    Placa
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {discharges.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="h-32 text-center text-muted-foreground"
                    >
                      Nenhuma descarga encontrada no periodo.
                    </TableCell>
                  </TableRow>
                ) : (
                  discharges.map((d) => (
                    <TableRow
                      key={d.id}
                      className="cursor-pointer hover:bg-muted/20 transition-colors duration-150 [&>td]:py-3"
                      onClick={() =>
                        router.push(`/fornecedores/${d.supplier_id}`)
                      }
                    >
                      <TableCell className="font-medium text-sm">
                        {formatDateBR(d.discharge_date)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {d.supplier?.name ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm tabular-nums">
                        {d.volume_mdc} MDC
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <DensityText value={d.density_kg_mdc} />
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm tabular-nums">
                        {formatCurrency(d.price_per_mdc)}
                      </TableCell>
                      <TableCell className="font-medium text-sm text-[#1B4332] tabular-nums">
                        {formatCurrency(d.net_total)}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell font-mono text-xs text-muted-foreground tracking-wider">
                        {d.truck_plate || "—"}
                      </TableCell>
                    </TableRow>
                  ))
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
        onOpenChange={setFormOpen}
        onSuccess={() => {
          fetchDischarges()
          fetchSummary()
        }}
      />
    </div>
  )
}
