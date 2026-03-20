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
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { queueStatusLabels } from "@/lib/labels"
import type { QueueEntryType, QueueStatus } from "@/types/database"
import type { Supplier } from "@/types/database"

interface EditEntry {
  id: string
  entry_type: QueueEntryType
  supplier_id: string
  truck_plate: string | null
  driver_name: string | null
  estimated_volume_mdc: number | null
  scheduled_date: string
  scheduled_time: string | null
  scheduled_position: number | null
  status: string
}

interface QueueFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultType?: QueueEntryType
  editEntry?: EditEntry | null
  onSuccess: () => void
}

interface FormData {
  entry_type: QueueEntryType
  supplier_id: string
  truck_plate: string
  driver_name: string
  estimated_volume_mdc: string
  scheduled_date: string
  scheduled_time: string
  scheduled_position: string
  status: QueueStatus
}

function getToday(): string {
  return new Date().toISOString().slice(0, 10)
}

function getInitialFormData(defaultType: QueueEntryType = "fila"): FormData {
  return {
    entry_type: defaultType,
    supplier_id: "",
    truck_plate: "",
    driver_name: "",
    estimated_volume_mdc: "",
    scheduled_date: getToday(),
    scheduled_time: "",
    scheduled_position: "",
    status: "aguardando",
  }
}

export function QueueForm({
  open,
  onOpenChange,
  defaultType = "fila",
  editEntry,
  onSuccess,
}: QueueFormProps) {
  const isEditing = !!editEntry
  const [form, setForm] = useState<FormData>(getInitialFormData(defaultType))
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({})
  const [loading, setLoading] = useState(false)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loadingSuppliers, setLoadingSuppliers] = useState(false)
  const [lastTruckPlate, setLastTruckPlate] = useState<string>("")
  const [averageVolume, setAverageVolume] = useState<number | null>(null)

  const fetchSuppliers = useCallback(async () => {
    setLoadingSuppliers(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from("suppliers")
      .select("*")
      .eq("status", "ativo")
      .order("name")

    if (!error && data) {
      setSuppliers(data)
    }
    setLoadingSuppliers(false)
  }, [])

  const fetchSupplierData = useCallback(async (supplierId: string) => {
    const supabase = createClient()

    // Fetch last truck plate from most recent discharge
    const { data: dischargeData } = await supabase
      .from("discharges")
      .select("truck_plate")
      .eq("supplier_id", supplierId)
      .order("discharge_date", { ascending: false })
      .limit(1)

    if (dischargeData && dischargeData.length > 0) {
      setLastTruckPlate(dischargeData[0].truck_plate || "")
    } else {
      setLastTruckPlate("")
    }

    // Fetch average volume from last 5 discharges
    const { data: volumeData } = await supabase
      .from("discharges")
      .select("volume_mdc")
      .eq("supplier_id", supplierId)
      .order("discharge_date", { ascending: false })
      .limit(5)

    if (volumeData && volumeData.length > 0) {
      const avgVol = volumeData.reduce((sum, d) => sum + (d.volume_mdc || 0), 0) / volumeData.length
      setAverageVolume(Math.round(avgVol * 100) / 100)
    } else {
      setAverageVolume(null)
    }
  }, [])

  useEffect(() => {
    if (open) {
      fetchSuppliers()
      if (editEntry) {
        setForm({
          entry_type: editEntry.entry_type,
          supplier_id: editEntry.supplier_id,
          truck_plate: editEntry.truck_plate || "",
          driver_name: editEntry.driver_name || "",
          estimated_volume_mdc: editEntry.estimated_volume_mdc ? String(editEntry.estimated_volume_mdc) : "",
          scheduled_date: editEntry.scheduled_date,
          scheduled_time: editEntry.scheduled_time || "",
          scheduled_position: editEntry.scheduled_position ? String(editEntry.scheduled_position) : "",
          status: editEntry.status as QueueStatus,
        })
      } else {
        setForm(getInitialFormData(defaultType))
      }
      setErrors({})
      setLastTruckPlate("")
      setAverageVolume(null)
    }
  }, [open, fetchSuppliers, defaultType, editEntry])

  useEffect(() => {
    if (form.supplier_id) {
      fetchSupplierData(form.supplier_id)
    }
  }, [form.supplier_id, fetchSupplierData])

  function updateField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))

    // Auto-fill truck_plate and estimated_volume when supplier changes
    if (key === "supplier_id") {
      if (lastTruckPlate) {
        setForm((prev) => ({ ...prev, truck_plate: lastTruckPlate }))
      }
      if (averageVolume) {
        setForm((prev) => ({ ...prev, estimated_volume_mdc: String(averageVolume) }))
      }
    }
  }

  function validate(): boolean {
    const newErrors: Partial<Record<keyof FormData, string>> = {}

    if (!form.supplier_id) newErrors.supplier_id = "Fornecedor é obrigatório"
    if (!form.truck_plate) newErrors.truck_plate = "Placa do caminhão é obrigatória"
    if (!form.estimated_volume_mdc) {
      newErrors.estimated_volume_mdc = "Volume estimado é obrigatório"
    } else if (Number(form.estimated_volume_mdc) <= 0) {
      newErrors.estimated_volume_mdc = "Volume deve ser maior que 0"
    }
    if (!form.scheduled_date) newErrors.scheduled_date = "Data é obrigatória"

    if (form.entry_type === "agendamento") {
      if (!form.scheduled_time && !form.scheduled_position) {
        newErrors.scheduled_time = "Escolha horário ou posição"
        newErrors.scheduled_position = "Escolha horário ou posição"
      }
      if (form.scheduled_position && Number(form.scheduled_position) < 1) {
        newErrors.scheduled_position = "Posição deve ser maior que 0"
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!validate()) return

    setLoading(true)
    const supabase = createClient()

    try {
      const { data: profile } = await supabase.auth.getUser()
      if (!profile.user) {
        throw new Error("Usuário não autenticado")
      }

      const { data: orgData } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", profile.user.id)
        .single()

      if (!orgData) {
        throw new Error("Organização não encontrada")
      }

      const entryData = {
        supplier_id: form.supplier_id,
        entry_type: form.entry_type,
        truck_plate: form.truck_plate || null,
        driver_name: form.driver_name || null,
        estimated_volume_mdc: Number(form.estimated_volume_mdc) || null,
        scheduled_date: form.scheduled_date,
        scheduled_time: form.entry_type === "agendamento" && form.scheduled_time ? form.scheduled_time : null,
        scheduled_position: form.entry_type === "agendamento" && form.scheduled_position ? Number(form.scheduled_position) : null,
      }

      if (editEntry) {
        const { error } = await supabase
          .from("queue_entries")
          .update({ ...entryData, status: form.status })
          .eq("id", editEntry.id)
        if (error) throw error
        toast.success("Entrada atualizada com sucesso")
      } else {
        const { error } = await supabase.from("queue_entries").insert([{
          ...entryData,
          organization_id: orgData.organization_id,
          queue_position: null,
          status: "aguardando" as const,
          created_by: profile.user.id,
        }])
        if (error) throw error
        toast.success(
          form.entry_type === "fila"
            ? "Entrada adicionada à fila com sucesso"
            : "Descarga agendada com sucesso"
        )
      }
      onOpenChange(false)
      onSuccess()
    } catch (err) {
      console.error(err)
      toast.error("Erro ao salvar entrada. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  const selectedSupplier = suppliers.find((s) => s.id === form.supplier_id)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? "Editar entrada"
              : form.entry_type === "fila" ? "Adicionar à Fila" : "Agendar Descarga"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Type toggle */}
          <div className="space-y-2">
            <Label>Tipo</Label>
            <div className="flex gap-2">
              {(["fila", "agendamento"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => updateField("entry_type", type)}
                  className={`flex-1 rounded-lg px-4 py-2 font-medium transition-all ${
                    form.entry_type === type
                      ? "bg-[#1B4332] text-white"
                      : "bg-white border border-[#E5E5E5] text-[#737373]"
                  }`}
                >
                  {type === "fila" ? "Fila" : "Agendamento"}
                </button>
              ))}
            </div>
          </div>

          {/* Status select (edit only) */}
          {isEditing && (
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(value) => updateField("status", value as QueueStatus)}
              >
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(queueStatusLabels) as [QueueStatus, string][]).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Supplier select */}
          <div className="space-y-2">
            <Label htmlFor="supplier">Fornecedor</Label>
            <Select value={form.supplier_id} onValueChange={(value) => updateField("supplier_id", value ?? "")}>
              <SelectTrigger id="supplier" className="h-11 rounded-xl">
                <SelectValue placeholder="Selecione um fornecedor">
                  {() => {
                    if (selectedSupplier) {
                      return `${selectedSupplier.name}${selectedSupplier.city ? ` - ${selectedSupplier.city}` : ""}`
                    }
                    if (form.supplier_id && loadingSuppliers) {
                      return "Carregando..."
                    }
                    return null
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name} {supplier.city && `- ${supplier.city}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.supplier_id && <p className="text-xs text-red-500">{errors.supplier_id}</p>}
          </div>

          {/* Truck info section */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-[#1B4332]">Informações do caminhão</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="truck_plate">Placa</Label>
                <Input
                  id="truck_plate"
                  type="text"
                  value={form.truck_plate}
                  onChange={(e) => updateField("truck_plate", e.target.value)}
                  placeholder="ex: ABC1D23"
                  className="h-11 rounded-xl"
                />
                {errors.truck_plate && <p className="text-xs text-red-500">{errors.truck_plate}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="driver_name">Motorista (opcional)</Label>
                <Input
                  id="driver_name"
                  type="text"
                  value={form.driver_name}
                  onChange={(e) => updateField("driver_name", e.target.value)}
                  placeholder="Nome do motorista"
                  className="h-11 rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="estimated_volume">Volume estimado (MDC)</Label>
                <Input
                  id="estimated_volume"
                  type="number"
                  value={form.estimated_volume_mdc}
                  onChange={(e) => updateField("estimated_volume_mdc", e.target.value)}
                  placeholder={averageVolume ? String(averageVolume) : "ex: 50"}
                  className="h-11 rounded-xl"
                  step="0.01"
                  min={0}
                />
                {errors.estimated_volume_mdc && (
                  <p className="text-xs text-red-500">{errors.estimated_volume_mdc}</p>
                )}
              </div>
            </div>
          </div>

          {/* Schedule section */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-[#1B4332]">
              {form.entry_type === "fila" ? "Data da fila" : "Agendamento"}
            </h3>

            <div className="space-y-2">
              <Label htmlFor="scheduled_date">Data</Label>
              <Input
                id="scheduled_date"
                type="date"
                value={form.scheduled_date}
                onChange={(e) => updateField("scheduled_date", e.target.value)}
                className="h-11 rounded-xl"
              />
              {errors.scheduled_date && <p className="text-xs text-red-500">{errors.scheduled_date}</p>}
            </div>

            {form.entry_type === "fila" ? (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
                A posição será calculada automaticamente com base na ordem de chegada.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="scheduled_time">Por horário</Label>
                  <Input
                    id="scheduled_time"
                    type="time"
                    value={form.scheduled_time}
                    onChange={(e) => updateField("scheduled_time", e.target.value)}
                    className="h-11 rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="scheduled_position">Por posição</Label>
                  <Select
                    value={form.scheduled_position}
                    onValueChange={(value) => updateField("scheduled_position", value ?? "")}
                  >
                    <SelectTrigger id="scheduled_position" className="h-11 rounded-xl">
                      <SelectValue placeholder="Selecione a posição" />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((pos) => (
                        <SelectItem key={pos} value={String(pos)}>
                          {pos}º{pos === 1 ? "º" : pos === 2 ? "º" : "º"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            {errors.scheduled_time && <p className="text-xs text-red-500">{errors.scheduled_time}</p>}
            {errors.scheduled_position && <p className="text-xs text-red-500">{errors.scheduled_position}</p>}
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
              {isEditing
                ? "Salvar alterações"
                : form.entry_type === "fila" ? "Adicionar à fila" : "Agendar descarga"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
