"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Truck,
  Scale,
  Package,
} from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import type { Discharge } from "@/types/database"

interface DischargeListProps {
  supplierId: string
  refreshKey?: number
}

const PAGE_SIZE = 10

function formatDateBR(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00")
  return d.toLocaleDateString("pt-BR")
}

function formatDateTimeBR(dateStr: string): string {
  return new Date(dateStr).toLocaleString("pt-BR")
}

function DensityBadge({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground">—</span>
  if (value >= 220) {
    return (
      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
        {value}
      </Badge>
    )
  }
  if (value >= 180) {
    return (
      <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
        {value}
      </Badge>
    )
  }
  return (
    <Badge className="bg-red-50 text-red-800 hover:bg-red-50">
      {value}
    </Badge>
  )
}

export function DischargeList({ supplierId, refreshKey }: DischargeListProps) {
  const [discharges, setDischarges] = useState<Discharge[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  const fetchDischarges = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    // Get total count
    const { count } = await supabase
      .from("discharges")
      .select("*", { count: "exact", head: true })
      .eq("supplier_id", supplierId)

    setTotalCount(count ?? 0)

    // Get paginated data
    const from = (page - 1) * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    const { data, error } = await supabase
      .from("discharges")
      .select("*")
      .eq("supplier_id", supplierId)
      .order("discharge_date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(from, to)

    if (error) {
      console.error("Erro ao buscar descargas:", error)
    } else {
      setDischarges(data ?? [])
    }
    setLoading(false)
  }, [supplierId, page])

  useEffect(() => {
    fetchDischarges()
  }, [fetchDischarges, refreshKey])

  // Summary stats (fetch all for totals)
  const [summary, setSummary] = useState<{
    totalVolume: number
    avgDensity: number | null
    totalPaid: number
  }>({ totalVolume: 0, avgDensity: null, totalPaid: 0 })

  const fetchSummary = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("discharges")
      .select("volume_mdc, density_kg_mdc, net_total")
      .eq("supplier_id", supplierId)

    if (!error && data) {
      const totalVolume = data.reduce((sum, d) => sum + Number(d.volume_mdc), 0)
      const densities = data
        .map((d) => d.density_kg_mdc)
        .filter((d): d is number => d !== null)
      const avgDensity =
        densities.length > 0
          ? Math.round(densities.reduce((a, b) => a + b, 0) / densities.length)
          : null
      const totalPaid = data.reduce((sum, d) => sum + Number(d.net_total ?? 0), 0)
      setSummary({ totalVolume, avgDensity, totalPaid })
    }
  }, [supplierId])

  useEffect(() => {
    fetchSummary()
  }, [fetchSummary, refreshKey])

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  // Reset page when refreshKey changes
  useEffect(() => {
    setPage(1)
  }, [refreshKey])

  if (loading && discharges.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Truck className="h-5 w-5" />
            Descargas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Truck className="h-5 w-5" />
          Descargas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary cards */}
        {totalCount > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Truck className="h-3 w-3" />
                Total descargas
              </p>
              <p className="text-lg font-bold mt-1">{totalCount}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Package className="h-3 w-3" />
                Volume total
              </p>
              <p className="text-lg font-bold mt-1">
                {summary.totalVolume.toLocaleString("pt-BR")} MDC
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Scale className="h-3 w-3" />
                Densidade media
              </p>
              <p className="text-lg font-bold mt-1">
                {summary.avgDensity !== null
                  ? `${summary.avgDensity} kg/mdc`
                  : "—"}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Valor total pago</p>
              <p className="text-lg font-bold mt-1 text-[#1B4332]">
                {formatCurrency(summary.totalPaid)}
              </p>
            </div>
          </div>
        )}

        {/* Table */}
        {totalCount === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhuma descarga registrada para este fornecedor.
          </p>
        ) : (
          <>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Volume</TableHead>
                    <TableHead className="hidden sm:table-cell">Densidade</TableHead>
                    <TableHead className="hidden md:table-cell">Preco</TableHead>
                    <TableHead>Valor a pagar</TableHead>
                    <TableHead className="hidden lg:table-cell">Placa</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {discharges.map((d) => {
                    const isExpanded = expandedId === d.id
                    return (
                      <ExpandableRow
                        key={d.id}
                        discharge={d}
                        isExpanded={isExpanded}
                        onToggle={() =>
                          setExpandedId(isExpanded ? null : d.id)
                        }
                      />
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between">
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
          </>
        )}
      </CardContent>
    </Card>
  )
}

function ExpandableRow({
  discharge,
  isExpanded,
  onToggle,
}: {
  discharge: Discharge
  isExpanded: boolean
  onToggle: () => void
}) {
  return (
    <>
      <TableRow
        className="cursor-pointer hover:bg-muted/50"
        onClick={onToggle}
      >
        <TableCell className="font-medium">
          {formatDateBR(discharge.discharge_date)}
        </TableCell>
        <TableCell>{discharge.volume_mdc} MDC</TableCell>
        <TableCell className="hidden sm:table-cell">
          <DensityBadge value={discharge.density_kg_mdc} />
        </TableCell>
        <TableCell className="hidden md:table-cell">
          {formatCurrency(discharge.price_per_mdc)}
        </TableCell>
        <TableCell className="font-medium text-[#1B4332]">
          {formatCurrency(discharge.net_total)}
        </TableCell>
        <TableCell className="hidden lg:table-cell">
          {discharge.truck_plate || "—"}
        </TableCell>
        <TableCell>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </TableCell>
      </TableRow>

      {isExpanded && (
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableCell colSpan={7} className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Peso bruto</p>
                <p className="font-medium">
                  {discharge.gross_weight_kg
                    ? `${Number(discharge.gross_weight_kg).toLocaleString("pt-BR")} kg`
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tara</p>
                <p className="font-medium">
                  {discharge.tare_weight_kg
                    ? `${Number(discharge.tare_weight_kg).toLocaleString("pt-BR")} kg`
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Peso liquido</p>
                <p className="font-medium">
                  {discharge.net_weight_kg
                    ? `${Number(discharge.net_weight_kg).toLocaleString("pt-BR")} kg`
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Umidade</p>
                <p className="font-medium">{discharge.moisture_percent}%</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Moinha</p>
                <p className="font-medium">
                  {Number(discharge.fines_kg) > 0
                    ? `${Number(discharge.fines_kg).toLocaleString("pt-BR")} kg`
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Densidade</p>
                <p className="font-medium">
                  {discharge.density_kg_mdc
                    ? `${discharge.density_kg_mdc} kg/mdc`
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Nota Fiscal</p>
                <p className="font-medium">
                  {discharge.invoice_number || "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Guia Florestal</p>
                <p className="font-medium">
                  {discharge.forest_guide || "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Descontos</p>
                <p className="font-medium">
                  {Number(discharge.deductions) > 0
                    ? formatCurrency(discharge.deductions)
                    : "—"}
                </p>
              </div>
              {discharge.notes && (
                <div className="col-span-2 md:col-span-3">
                  <p className="text-xs text-muted-foreground">Observacoes</p>
                  <p className="font-medium">{discharge.notes}</p>
                </div>
              )}
              <div className="col-span-2 md:col-span-3">
                <p className="text-xs text-muted-foreground">
                  Registrado em {formatDateTimeBR(discharge.created_at)}
                </p>
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}
