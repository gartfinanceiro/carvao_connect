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
import { Loader2, FileCheck, FileX, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { queueStatusLabels } from "@/lib/labels"
import type { QueueEntryType, QueueStatus } from "@/types/database"
import type { Supplier } from "@/types/database"
import { getSupplierSuggestions } from "@/lib/supplier-suggestions"

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
  gca_emitida?: boolean
  status: string
}

interface QueueFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultType?: QueueEntryType
  defaultSupplierId?: string
  editEntry?: EditEntry | null
  onSuccess: () => void
}

interface FormData {
  entry_type: QueueEntryType
  supplier_id: string
  gca_emitida: boolean
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
    gca_emitida: false,
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
  defaultSupplierId,
  editEntry,
  onSuccess,
}: QueueFormProps) {
  const isEditing = !!editEntry
  const [form, setForm] = useState<FormData>(() => {
    const initial = getInitialFormData(defaultType)
    if (defaultSupplierId) initial.supplier_id = defaultSupplierId
    return initial
  })
  const [errors, setErrors] = useState<Partial<Record<keyof FormData | "driver_name", string>>>({})
  const [loading, setLoading] = useState(false)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loadingSuppliers, setLoadingSuppliers] = useState(false)
  const [suggestedFields, setSuggestedFields] = useState<Set<keyof FormData>>(new Set())

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

  const applySuggestions = useCallback(async (supplierId: string) => {
    if (editEntry) return
    const supabase = createClient()
    try {
      const suggestions = await getSupplierSuggestions(supabase, supplierId)
      setForm((prev) => {
        const next = { ...prev }
        const suggested = new Set<keyof FormData>()

        if (suggestions.truck_plate && !prev.truck_plate) {
          next.truck_plate = suggestions.truck_plate.toUpperCase()
          suggested.add("truck_plate")
        }

        if (suggestions.driver_name && !prev.driver_name) {
          next.driver_name = suggestions.driver_name
          suggested.add("driver_name")
        }

        if (suggestions.avg_volume_mdc && !prev.estimated_volume_mdc) {
          next.estimated_volume_mdc = String(suggestions.avg_volume_mdc)
          suggested.add("estimated_volume_mdc")
        }

        setSuggestedFields(suggested)
        return next
      })
    } catch {
      // fire-and-forget
    }
  }, [editEntry])

  useEffect(() => {
    if (open) {
      fetchSuppliers()
      if (editEntry) {
        setForm({
          entry_type: editEntry.entry_type,
          supplier_id: editEntry.supplier_id,
          gca_emitida: editEntry.gca_emitida ?? false,
          truck_plate: editEntry.truck_plate || "",
          driver_name: editEntry.driver_name || "",
          estimated_volume_mdc: editEntry.estimated_volume_mdc ? String(editEntry.estimated_volume_mdc) : "",
          scheduled_date: editEntry.scheduled_date,
          scheduled_time: editEntry.scheduled_time || "",
          scheduled_position: editEntry.scheduled_position ? String(editEntry.scheduled_position) : "",
          status: editEntry.status as QueueStatus,
        })
      } else {
        const initial = getInitialFormData(defaultType)
        if (defaultSupplierId) {
          initial.supplier_id = defaultSupplierId
          applySuggestions(defaultSupplierId)
        }
        setForm(initial)
      }
      setErrors({})
      setSuggestedFields(new Set())
    }
  }, [open, fetchSuppliers, defaultType, defaultSupplierId, editEntry, applySuggestions])

  function updateField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
    // Clear suggestion indicator when user manually edits
    if (suggestedFields.has(key)) {
      setSuggestedFields((prev) => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }
    // Fetch suggestions when supplier changes
    if (key === "supplier_id" && value) {
      applySuggestions(value as string)
    }
  }

  function validate(): boolean {
    const newErrors: Partial<Record<keyof FormData, string>> = {}

    if (!form.supplier_id) newErrors.supplier_id = "Fornecedor é obrigatório"
    if (form.gca_emitida && !form.truck_plate.trim()) newErrors.truck_plate = "Placa é obrigatória quando GCA emitida"
    if (form.gca_emitida && !form.driver_name.trim()) newErrors.driver_name = "Motorista é obrigatório quando GCA emitida"
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
        gca_emitida: form.gca_emitida,
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
      <DialogContent className="sm:max-w-2xl lg:max-w-3xl max-h-[90vh] overflow-y-auto">
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
              <SelectTrigger id="supplier" className="h-11 w-full rounded-xl">
                <SelectValue placeholder="Selecione um fornecedor">
                  {() => {
                    if (selectedSupplier) {
                      return `${selectedSupplier.name}${selectedSupplier.dcf_number ? ` — DCF ${selectedSupplier.dcf_number}` : ""}${selectedSupplier.city ? ` — ${selectedSupplier.city}` : ""}`
                    }
                    if (form.supplier_id && loadingSuppliers) {
                      return "Carregando..."
                    }
                    return null
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="min-w-[min(28rem,calc(100vw-2rem))]">
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                    {supplier.dcf_number && (
                      <span className="text-muted-foreground ml-1">— DCF {supplier.dcf_number}</span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.supplier_id && <p className="text-xs text-red-500">{errors.supplier_id}</p>}
          </div>

          {/* GCA toggle */}
          <div className="space-y-2">
            <Label>GCA (Guia de Controle Ambiental)</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setForm(prev => ({ ...prev, gca_emitida: false }))}
                className={`flex-1 flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 font-medium transition-all ${
                  !form.gca_emitida
                    ? "bg-amber-50 border-2 border-amber-300 text-amber-800"
                    : "bg-white border border-[#E5E5E5] text-[#737373]"
                }`}
              >
                <FileX className="h-4 w-4" />
                Não emitida
              </button>
              <button
                type="button"
                onClick={() => setForm(prev => ({ ...prev, gca_emitida: true }))}
                className={`flex-1 flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 font-medium transition-all ${
                  form.gca_emitida
                    ? "bg-emerald-50 border-2 border-emerald-300 text-emerald-800"
                    : "bg-white border border-[#E5E5E5] text-[#737373]"
                }`}
              >
                <FileCheck className="h-4 w-4" />
                Emitida
              </button>
            </div>
            {!form.gca_emitida && (
              <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                Placa e motorista poderão ser informados depois na aba Fila, quando a GCA for emitida.
              </p>
            )}
          </div>

          {/* Truck info section */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-[#1B4332]">Informações do caminhão</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="truck_plate">Placa {form.gca_emitida ? "" : "(opcional)"}</Label>
                <Input
                  id="truck_plate"
                  type="text"
                  value={form.truck_plate}
                  onChange={(e) => updateField("truck_plate", e.target.value.toUpperCase())}
                  placeholder="ex: ABC1D23"
                  className="h-11 rounded-xl"
                />
                {errors.truck_plate && <p className="text-xs text-red-500">{errors.truck_plate}</p>}
                {suggestedFields.has("truck_plate") && (
                  <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Sparkles className="h-3 w-3" /> Sugerido com base no histórico
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="driver_name">Motorista {form.gca_emitida ? "" : "(opcional)"}</Label>
                <Input
                  id="driver_name"
                  type="text"
                  value={form.driver_name}
                  onChange={(e) => updateField("driver_name", e.target.value)}
                  placeholder="Nome do motorista"
                  className="h-11 rounded-xl"
                />
                {errors.driver_name && <p className="text-xs text-red-500">{errors.driver_name}</p>}
                {suggestedFields.has("driver_name") && (
                  <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Sparkles className="h-3 w-3" /> Sugerido com base no histórico
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="estimated_volume">Volume estimado (MDC)</Label>
                <Input
                  id="estimated_volume"
                  type="number"
                  value={form.estimated_volume_mdc}
                  onChange={(e) => updateField("estimated_volume_mdc", e.target.value)}
                  placeholder="ex: 50"
                  className="h-11 rounded-xl"
                  step="0.01"
                  min={0}
                />
                {errors.estimated_volume_mdc && (
                  <p className="text-xs text-red-500">{errors.estimated_volume_mdc}</p>
                )}
                {suggestedFields.has("estimated_volume_mdc") && (
                  <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Sparkles className="h-3 w-3" /> Sugerido com base no histórico
                  </p>
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
