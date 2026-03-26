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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Truck,
  Scale,
  Package,
  Printer,
  Pencil,
  Trash2,
  Loader2,
} from "lucide-react"
import { formatCurrency, convertVolume, convertPrice, unitLabel, priceUnitLabel } from "@/lib/utils"
import type { VolumeUnit } from "@/lib/utils"
import { UnitToggle } from "@/components/unit-toggle"
import { useSubscription } from "@/components/subscription-provider"
import { DischargeForm } from "@/components/discharge-form"
import { generateDischargeTicket } from "@/lib/generate-discharge-ticket"
import type { DischargeTicketData } from "@/lib/generate-discharge-ticket"
import { logActivity } from "@/lib/activity-logger"
import { toast } from "sonner"
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
  const { canSeeFinancials, isAdmin } = useSubscription()
  const [discharges, setDischarges] = useState<Discharge[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [unit, setUnit] = useState<VolumeUnit>("mdc")

  // Edit/Delete
  const [editDischarge, setEditDischarge] = useState<Discharge | null>(null)
  const [editFormOpen, setEditFormOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Discharge | null>(null)
  const [deleting, setDeleting] = useState(false)

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
    rawData: { volume_mdc: number; density_kg_mdc: number | null }[]
  }>({ totalVolume: 0, avgDensity: null, totalPaid: 0, rawData: [] })

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
      setSummary({
        totalVolume,
        avgDensity,
        totalPaid,
        rawData: data.map(d => ({ volume_mdc: Number(d.volume_mdc), density_kg_mdc: d.density_kg_mdc })),
      })
    }
  }, [supplierId])

  useEffect(() => {
    fetchSummary()
  }, [fetchSummary, refreshKey])

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  const kpiVolume = useMemo(() => {
    if (unit === "mdc") return summary.totalVolume
    return summary.rawData.reduce(
      (sum, d) => sum + convertVolume(d.volume_mdc, d.density_kg_mdc, unit),
      0,
    )
  }, [unit, summary])

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
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Truck className="h-5 w-5" />
          Descargas
        </CardTitle>
        <UnitToggle unit={unit} onChange={setUnit} />
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary cards */}
        {totalCount > 0 && (
          <div className={`grid grid-cols-2 ${canSeeFinancials ? "lg:grid-cols-4" : "lg:grid-cols-3"} gap-3`}>
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
                {(Math.round(kpiVolume * 10) / 10).toLocaleString("pt-BR")} {unitLabel(unit)}
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
            {canSeeFinancials && (
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Valor total pago</p>
                <p className="text-lg font-bold mt-1 text-[#1B4332]">
                  {formatCurrency(summary.totalPaid)}
                </p>
              </div>
            )}
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
                    <TableHead>Volume ({unitLabel(unit)})</TableHead>
                    <TableHead className="hidden sm:table-cell">Densidade</TableHead>
                    {canSeeFinancials && <TableHead className="hidden md:table-cell">Preço ({priceUnitLabel(unit)})</TableHead>}
                    {canSeeFinancials && <TableHead>Valor a pagar</TableHead>}
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
                        supplierId={supplierId}
                        isExpanded={isExpanded}
                        onToggle={() =>
                          setExpandedId(isExpanded ? null : d.id)
                        }
                        unit={unit}
                        showFinancials={canSeeFinancials}
                        isAdmin={isAdmin}
                        onEdit={(disc) => { setEditDischarge(disc); setEditFormOpen(true) }}
                        onDelete={(disc) => setDeleteTarget(disc)}
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

      {/* Edit Form */}
      <DischargeForm
        open={editFormOpen}
        onOpenChange={(open) => { setEditFormOpen(open); if (!open) setEditDischarge(null) }}
        supplierId={supplierId}
        editDischarge={editDischarge}
        onSuccess={() => { setEditFormOpen(false); setEditDischarge(null); fetchDischarges(); fetchSummary() }}
      />

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir descarga</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja excluir a descarga
            {deleteTarget?.discharge_number ? ` Nº ${String(deleteTarget.discharge_number).padStart(4, "0")}` : ""}?
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

                // Clear references
                await supabase.from("interactions").update({ resolved_discharge_id: null }).eq("resolved_discharge_id", deleteTarget.id)
                await supabase.from("queue_entries").update({ discharge_id: null }).eq("discharge_id", deleteTarget.id)
                await supabase.from("activity_log").delete().eq("discharge_id", deleteTarget.id)

                // Delete
                const { error } = await supabase.from("discharges").delete().eq("id", deleteTarget.id)
                if (error) {
                  toast.error("Erro ao excluir descarga.")
                } else {
                  // Log deletion for audit
                  logActivity({
                    supabase,
                    eventType: "discharge_deleted",
                    userId: user?.id,
                    supplierId,
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
    </Card>
  )
}

function ExpandableRow({
  discharge,
  supplierId,
  isExpanded,
  onToggle,
  unit,
  showFinancials,
  isAdmin,
  onEdit,
  onDelete,
}: {
  discharge: Discharge
  supplierId: string
  isExpanded: boolean
  onToggle: () => void
  unit: VolumeUnit
  showFinancials: boolean
  isAdmin: boolean
  onEdit: (d: Discharge) => void
  onDelete: (d: Discharge) => void
}) {
  const [printing, setPrinting] = useState(false)

  async function handlePrintTicket(e: React.MouseEvent) {
    e.stopPropagation()
    setPrinting(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single()
      if (!profile?.organization_id) return

      const [{ data: org }, { data: sup }] = await Promise.all([
        supabase
          .from("organizations")
          .select("name, document, address, city, state, phone, state_registration")
          .eq("id", profile.organization_id)
          .single(),
        supabase
          .from("suppliers")
          .select("name, document, person_type, bank_name, bank_agency, bank_account")
          .eq("id", supplierId)
          .single(),
      ])

      const ticketData: DischargeTicketData = {
        org: {
          name: org?.name || "",
          document: org?.document,
          address: org?.address,
          city: org?.city,
          state: org?.state,
          phone: org?.phone,
          state_registration: org?.state_registration,
        },
        supplier: {
          name: sup?.name || "",
          document: sup?.document,
          person_type: sup?.person_type as "pf" | "pj" | null,
          bank_name: sup?.bank_name,
          bank_agency: sup?.bank_agency,
          bank_account: sup?.bank_account,
        },
        discharge: {
          discharge_number: discharge.discharge_number,
          discharge_date: discharge.discharge_date,
          volume_mdc: discharge.volume_mdc,
          gross_weight_kg: discharge.gross_weight_kg,
          tare_weight_kg: discharge.tare_weight_kg,
          net_weight_kg: discharge.net_weight_kg,
          density_kg_mdc: discharge.density_kg_mdc,
          moisture_percent: discharge.moisture_percent,
          fines_kg: discharge.fines_kg,
          fines_percent: discharge.fines_percent,
          price_per_mdc: discharge.price_per_mdc,
          gross_total: discharge.gross_total,
          deductions: discharge.deductions,
          net_total: discharge.net_total,
          funrural_percent: discharge.funrural_percent,
          funrural_value: discharge.funrural_value,
          truck_plate: discharge.truck_plate,
          invoice_number: discharge.invoice_number,
          forest_guide: discharge.forest_guide,
          charcoal_type: discharge.charcoal_type,
          pricing_unit: discharge.pricing_unit,
          notes: discharge.notes,
        },
      }

      generateDischargeTicket(ticketData)
    } catch (err) {
      console.error("Erro ao gerar ticket:", err)
    } finally {
      setPrinting(false)
    }
  }

  return (
    <>
      <TableRow
        className="cursor-pointer hover:bg-muted/50"
        onClick={onToggle}
      >
        <TableCell className="font-medium">
          {formatDateBR(discharge.discharge_date)}
        </TableCell>
        <TableCell>{convertVolume(discharge.volume_mdc, discharge.density_kg_mdc, unit)} {unitLabel(unit)}</TableCell>
        <TableCell className="hidden sm:table-cell">
          <DensityBadge value={discharge.density_kg_mdc} />
        </TableCell>
        {showFinancials && (
          <TableCell className="hidden md:table-cell">
            {formatCurrency(convertPrice(discharge.price_per_mdc, discharge.density_kg_mdc, unit))}
          </TableCell>
        )}
        {showFinancials && (
          <TableCell className="font-medium text-[#1B4332]">
            {formatCurrency(discharge.net_total)}
          </TableCell>
        )}
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
          <TableCell colSpan={showFinancials ? 7 : 5} className="p-4">
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
                <p className="text-xs text-muted-foreground">Impurezas</p>
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
              {showFinancials && (
                <div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    Valor bruto
                    {discharge.pricing_unit === "ton" && (
                      <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-amber-100 text-amber-700">TON</span>
                    )}
                  </p>
                  <p className="font-medium">
                    {discharge.gross_total
                      ? formatCurrency(discharge.gross_total)
                      : "—"}
                  </p>
                </div>
              )}
              {showFinancials && (
                <div>
                  <p className="text-xs text-muted-foreground">Descontos</p>
                  <p className="font-medium">
                    {Number(discharge.deductions) > 0
                      ? <span className="text-red-600">-{formatCurrency(discharge.deductions)}</span>
                      : "—"}
                  </p>
                </div>
              )}
              {showFinancials && (
                <div>
                  <p className="text-xs text-muted-foreground">Valor líquido</p>
                  <p className="font-medium">
                    {discharge.net_total
                      ? formatCurrency(discharge.net_total)
                      : "—"}
                  </p>
                </div>
              )}
              {showFinancials && Number(discharge.funrural_percent) > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground">FUNRURAL ({discharge.funrural_percent}%)</p>
                  <p className="font-medium text-amber-700">
                    -{formatCurrency(discharge.funrural_value)}
                  </p>
                </div>
              )}
              {showFinancials && Number(discharge.funrural_percent) > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground">Valor a pagar</p>
                  <p className="font-bold text-[#1B4332]">
                    {formatCurrency((discharge.net_total || 0) - (discharge.funrural_value || 0))}
                  </p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground">Tipo de carvão</p>
                <p className="font-medium">{discharge.charcoal_type || "—"}</p>
              </div>
              {discharge.notes && (
                <div className="col-span-2 md:col-span-3">
                  <p className="text-xs text-muted-foreground">Observacoes</p>
                  <p className="font-medium">{discharge.notes}</p>
                </div>
              )}
              <div className="col-span-2 md:col-span-3 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Registrado em {formatDateTimeBR(discharge.created_at)}
                  {discharge.discharge_number ? ` · Nº ${String(discharge.discharge_number).padStart(4, "0")}` : ""}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1.5"
                    onClick={(e) => { e.stopPropagation(); onEdit(discharge) }}
                  >
                    <Pencil className="h-3 w-3" />
                    Editar
                  </Button>
                  {isAdmin && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
                      onClick={(e) => { e.stopPropagation(); onDelete(discharge) }}
                    >
                      <Trash2 className="h-3 w-3" />
                      Excluir
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1.5"
                    onClick={handlePrintTicket}
                    disabled={printing}
                  >
                    {printing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Printer className="h-3 w-3" />}
                    Imprimir ticket
                  </Button>
                </div>
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}
