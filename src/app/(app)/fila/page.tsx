"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Pencil, X } from "lucide-react"
import { toast } from "sonner"
import { QueueForm } from "@/components/queue-form"
import { DischargeForm } from "@/components/discharge-form"
import { queueStatusLabels, queueEntryTypeLabels } from "@/lib/labels"
import { convertVolume, unitLabel } from "@/lib/utils"
import type { VolumeUnit } from "@/lib/utils"
import { UnitToggle } from "@/components/unit-toggle"
import { AccessGate } from "@/components/access-gate"
import type { QueueEntry, Supplier, QueueStatus, QueueEntryType } from "@/types/database"

interface QueueEntryWithSupplier extends Omit<QueueEntry, 'suppliers'> {
  suppliers: Supplier | null
  creator: { name: string } | null
}

export default function FilaPage() {
  return (
    <AccessGate module="fila">
      <FilaContent />
    </AccessGate>
  )
}

function FilaContent() {
  const [entries, setEntries] = useState<QueueEntryWithSupplier[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10))
  const [queueFormOpen, setQueueFormOpen] = useState(false)
  const [dischargeFormOpen, setDischargeFormOpen] = useState(false)
  const [selectedQueueId, setSelectedQueueId] = useState<string | null>(null)
  const [defaultType, setDefaultType] = useState<QueueEntryType>("fila")
  const [filterType, setFilterType] = useState<QueueEntryType | "todos">("todos")
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [editEntry, setEditEntry] = useState<QueueEntryWithSupplier | null>(null)
  const [unit, setUnit] = useState<VolumeUnit>("mdc")

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    try {
      const { data: profile } = await supabase.auth.getUser()
      if (!profile.user) return

      const { data: orgData } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", profile.user.id)
        .single()

      if (!orgData) return

      let query = supabase
        .from("queue_entries")
        .select("*, suppliers(name, avg_density, last_price), creator:profiles!created_by(name)")
        .eq("organization_id", orgData.organization_id)
        .eq("scheduled_date", selectedDate)

      if (filterType !== "todos") {
        query = query.eq("entry_type", filterType)
      }

      const { data, error } = await query.order("scheduled_position", { ascending: true, nullsFirst: true }).order("scheduled_time", { ascending: true, nullsFirst: true }).order("queue_position", { ascending: true, nullsFirst: true })

      if (error) throw error

      setEntries(data || [])
    } catch (err) {
      console.error(err)
      toast.error("Erro ao carregar fila")
    } finally {
      setLoading(false)
    }
  }, [selectedDate, filterType])

  useEffect(() => {
    fetchEntries()
  }, [fetchEntries])

  const handleDischargeClick = (queueId: string) => {
    setSelectedQueueId(queueId)
    setDischargeFormOpen(true)
  }

  const handleDischargeSuccess = async () => {
    // Update the queue entry status to concluido
    const supabase = createClient()
    if (selectedQueueId) {
      await supabase
        .from("queue_entries")
        .update({ status: "concluido" as QueueStatus })
        .eq("id", selectedQueueId)
    }
    setDischargeFormOpen(false)
    setSelectedQueueId(null)
    fetchEntries()
  }

  const handleCancel = async (queueId: string) => {
    if (!window.confirm("Deseja cancelar esta entrada?")) return

    setCancellingId(queueId)
    const supabase = createClient()

    try {
      const { error } = await supabase
        .from("queue_entries")
        .update({ status: "cancelado" as QueueStatus })
        .eq("id", queueId)

      if (error) throw error

      toast.success("Entrada cancelada")
      fetchEntries()
    } catch (err) {
      console.error(err)
      toast.error("Erro ao cancelar entrada")
    } finally {
      setCancellingId(null)
    }
  }

  const statusColors: Record<QueueStatus, string> = {
    aguardando: "bg-amber-100 text-amber-800",
    em_descarga: "bg-blue-100 text-blue-800",
    concluido: "bg-green-100 text-green-800",
    cancelado: "bg-gray-100 text-gray-800",
  }

  const pendingCount = entries.filter((e) => e.status === "aguardando").length
  const dischargingCount = entries.filter((e) => e.status === "em_descarga").length
  const completedCount = entries.filter((e) => e.status === "concluido").length
  const totalVolume = entries.reduce((sum, e) => sum + (e.estimated_volume_mdc || 0), 0)

  const convertedTotalVolume = entries.reduce((sum, e) => {
    const vol = e.estimated_volume_mdc || 0
    const density = (e.suppliers as Supplier | null)?.avg_density ?? null
    return sum + convertVolume(vol, density, unit)
  }, 0)

  function entryVolume(entry: QueueEntryWithSupplier): string {
    const vol = entry.estimated_volume_mdc
    if (!vol) return "—"
    const density = (entry.suppliers as Supplier | null)?.avg_density ?? null
    return `${convertVolume(vol, density, unit)} ${unitLabel(unit)}`
  }


  function generateWhatsAppText() {
    const dateObj = new Date(selectedDate + "T12:00:00")
    const dateFormatted = dateObj.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })
    const scheduled = entries.filter(e => e.entry_type === "agendamento" && e.status !== "cancelado")
    const queue = entries.filter(e => e.entry_type === "fila" && e.status !== "cancelado")
    const lines: string[] = []
    lines.push("\ud83d\udccb *Fila & Agendamento*")
    lines.push("\ud83d\udcc5 " + dateFormatted)
    lines.push("")
    if (scheduled.length > 0) {
      lines.push("*Agendados:*")
      for (const e of scheduled) {
        const time = e.scheduled_time ? e.scheduled_time.slice(0, 5) : String(e.scheduled_position) + "\u00ba"
        const supplier = (e.suppliers as any)?.name ?? "Fornecedor"
        const st = e.status === "concluido" ? " \u2705" : e.status === "em_descarga" ? " \ud83d\udd04" : ""
        const vol = e.estimated_volume_mdc ? convertVolume(e.estimated_volume_mdc, (e.suppliers as Supplier | null)?.avg_density ?? null, unit) : "?"
        lines.push(time + " - " + supplier + " | " + (e.truck_plate ?? "") + " | " + vol + " " + unitLabel(unit) + st)
      }
      lines.push("")
    }
    if (queue.length > 0) {
      lines.push("*Fila:*")
      for (const e of queue) {
        const supplier = (e.suppliers as any)?.name ?? "Fornecedor"
        const st = e.status === "concluido" ? " \u2705" : e.status === "em_descarga" ? " \ud83d\udd04" : ""
        const vol = e.estimated_volume_mdc ? convertVolume(e.estimated_volume_mdc, (e.suppliers as Supplier | null)?.avg_density ?? null, unit) : "?"
        lines.push(String(e.queue_position) + "\u00ba - " + supplier + " | " + (e.truck_plate ?? "") + " | " + vol + " " + unitLabel(unit) + st)
      }
      lines.push("")
    }
    lines.push("Total: " + (Math.round(convertedTotalVolume * 10) / 10) + " " + unitLabel(unit) + " | " + pendingCount + " aguardando | " + completedCount + " concluidos")
    return lines.join("\n")
  }

  async function handleCopyWhatsApp() {
    const text = generateWhatsAppText()
    await navigator.clipboard.writeText(text)
    toast.success("Texto copiado! Cole no WhatsApp.")
  }





  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="border-b border-[#E5E5E5] px-6 py-4 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-[#1B4332]">Fila & Agendamento</h1>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 border border-[#E5E5E5] rounded-lg text-sm"
            />
            <Button
              onClick={() => {
                setEditEntry(null)
                setDefaultType("fila")
                setQueueFormOpen(true)
              }}
              className="bg-[#1B4332] hover:bg-[#2D6A4F]"
            >
              Adicionar à fila
            </Button>
            <Button
              onClick={() => {
                setEditEntry(null)
                setDefaultType("agendamento")
                setQueueFormOpen(true)
              }}
              variant="outline"
            >
              Agendar descarga
            </Button>
            <div className="w-px h-6 bg-[#E5E5E5]" />
            <UnitToggle unit={unit} onChange={setUnit} />
            <Button
              onClick={handleCopyWhatsApp}
              variant="outline"
              className="text-[13px]"
            >
              📋 Copiar lista
            </Button>

          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-[#737373] uppercase tracking-wide font-semibold mb-1">
                Aguardando
              </p>
              <p className="text-2xl font-bold text-[#1B4332]">{pendingCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-[#737373] uppercase tracking-wide font-semibold mb-1">
                Em descarga
              </p>
              <p className="text-2xl font-bold text-blue-600">{dischargingCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-[#737373] uppercase tracking-wide font-semibold mb-1">
                Concluídos
              </p>
              <p className="text-2xl font-bold text-green-600">{completedCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-[#737373] uppercase tracking-wide font-semibold mb-1">
                Volume total
              </p>
              <p className="text-2xl font-bold text-[#1B4332]">{(Math.round(convertedTotalVolume * 10) / 10).toFixed(1)} {unitLabel(unit)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2">
          {(["todos", "agendamento", "fila"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilterType(tab)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                filterType === tab
                  ? "bg-[#1B4332] text-white"
                  : "bg-white border border-[#E5E5E5] text-[#737373]"
              }`}
            >
              {tab === "todos" ? "Todos" : tab === "agendamento" ? "Agendados" : "Fila"}
            </button>
          ))}
        </div>
      </div>

      {/* Queue list */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-[#1B4332]" />
          </div>
        ) : entries.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-[#737373]">Nenhuma entrada para esta data</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="space-y-2">
                {entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center gap-4 p-4 border-b border-[#E5E5E5] last:border-b-0 hover:bg-[#F8F8F8] transition-colors"
                  >
                    {/* Position/time */}
                    <div className="flex-shrink-0 w-16 text-center">
                      {entry.entry_type === "agendamento" ? (
                        <div>
                          <p className="text-lg font-bold text-[#1B4332]">
                            {entry.scheduled_time
                              ? entry.scheduled_time.slice(0, 5)
                              : entry.scheduled_position
                                ? `${entry.scheduled_position}º`
                                : "—"}
                          </p>
                          <p className="text-xs text-[#737373]">
                            {entry.scheduled_time ? "Horário" : entry.scheduled_position ? "Posição" : "Agendado"}
                          </p>
                        </div>
                      ) : (
                        <div>
                          <p className="text-lg font-bold text-[#1B4332]">
                            {entry.queue_position || "—"}
                          </p>
                          <p className="text-xs text-[#737373]">Posição</p>
                        </div>
                      )}
                    </div>

                    {/* Supplier and truck info */}
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/fornecedores/${entry.supplier_id}`}
                        className="font-semibold text-[#1B4332] hover:underline block truncate"
                      >
                        {entry.suppliers?.name || "—"}
                      </Link>
                      <p className="text-xs text-[#737373]">
                        {entry.truck_plate && `Placa: ${entry.truck_plate}`}
                        {entry.truck_plate && entry.driver_name && " | "}
                        {entry.driver_name && `Motorista: ${entry.driver_name}`}
                        {(entry.truck_plate || entry.driver_name) && entry.creator?.name && " · "}
                        {entry.creator?.name && `por ${entry.creator.name}`}
                      </p>
                    </div>

                    {/* Volume */}
                    <div className="flex-shrink-0 text-right">
                      <p className="font-semibold text-[#1B4332]">
                        {entryVolume(entry)}
                      </p>
                    </div>

                    {/* Status badge */}
                    <div className="flex-shrink-0">
                      <Badge className={statusColors[entry.status]}>
                        {queueStatusLabels[entry.status]}
                      </Badge>
                    </div>

                    {/* Type badge */}
                    <div className="flex-shrink-0">
                      <Badge variant="outline">
                        {queueEntryTypeLabels[entry.entry_type]}
                      </Badge>
                    </div>

                    {/* Actions */}
                    <div className="flex-shrink-0 flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditEntry(entry)
                          setQueueFormOpen(true)
                        }}
                        className="text-[#1B4332] hover:bg-[#1B4332]/10"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {entry.status !== "concluido" && entry.status !== "cancelado" && (
                        <Button
                          size="sm"
                          onClick={() => handleDischargeClick(entry.id)}
                          className="bg-[#1B4332] hover:bg-[#2D6A4F] text-xs"
                        >
                          Registrar descarga
                        </Button>
                      )}
                      {entry.status !== "concluido" && entry.status !== "cancelado" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCancel(entry.id)}
                          disabled={cancellingId === entry.id}
                          className="text-red-600 hover:bg-red-50"
                        >
                          {cancellingId === entry.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <X className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Modals */}
      <QueueForm
        open={queueFormOpen}
        onOpenChange={(open) => {
          setQueueFormOpen(open)
          if (!open) setEditEntry(null)
        }}
        defaultType={defaultType}
        editEntry={editEntry}
        onSuccess={fetchEntries}
      />

      {selectedQueueId && (
        <DischargeForm
          open={dischargeFormOpen}
          onOpenChange={setDischargeFormOpen}
          supplierId={entries.find((e) => e.id === selectedQueueId)?.supplier_id}
          onSuccess={handleDischargeSuccess}
        />
      )}
    </div>
  )
}
