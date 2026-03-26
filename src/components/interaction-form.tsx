"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Info, Loader2, CalendarIcon } from "lucide-react"
import { toast } from "sonner"
import {
  contactTypeLabels,
  contactTypeIcons,
  contactResultLabels,
} from "@/lib/labels"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import type { ContactType, ContactResult, NextStepType } from "@/types/database"
import { logActivity } from "@/lib/activity-logger"

interface InteractionFormProps {
  supplierId: string
  supplierName: string
  organizationId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  defaultContactType?: ContactType
  defaultResult?: ContactResult
  defaultNotes?: string
  defaultLoadPromised?: boolean
  defaultVolume?: string
  defaultDate?: Date
  defaultNextStep?: NextStepType
  defaultNextStepDate?: Date
  suggestionId?: string
  onSuggestionLinked?: (interactionId: string) => void
}

export function InteractionForm({
  supplierId,
  supplierName,
  organizationId,
  open,
  onOpenChange,
  onSuccess,
  defaultContactType,
  defaultResult,
  defaultNotes,
  defaultLoadPromised,
  defaultVolume,
  defaultDate,
  defaultNextStep,
  defaultNextStepDate,
  suggestionId,
  onSuggestionLinked,
}: InteractionFormProps) {
  const [contactType, setContactType] = useState<ContactType | null>(defaultContactType ?? null)
  const [result, setResult] = useState<ContactResult | null>(defaultResult ?? null)
  const [notes, setNotes] = useState(defaultNotes ?? "")
  const [loadPromised, setLoadPromised] = useState(defaultLoadPromised ?? false)
  const [promisedVolume, setPromisedVolume] = useState(defaultVolume ?? "1")
  const [promisedDate, setPromisedDate] = useState<Date | undefined>(defaultDate)
  const [nextStep, setNextStep] = useState<NextStepType | null>(defaultNextStep ?? null)
  const [nextStepDate, setNextStepDate] = useState<Date | undefined>(defaultNextStepDate)
  const [nextStepTime, setNextStepTime] = useState("09:00")
  const [scheduleQueue, setScheduleQueue] = useState(false)
  const [queueEntryType, setQueueEntryType] = useState<"fila" | "agendamento">("agendamento")
  const [truckPlate, setTruckPlate] = useState("")
  const [driverName, setDriverName] = useState("")
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  function resetForm() {
    setContactType(defaultContactType ?? null)
    setResult(defaultResult ?? null)
    setNotes(defaultNotes ?? "")
    setLoadPromised(defaultLoadPromised ?? false)
    setPromisedVolume(defaultVolume ?? "1")
    setPromisedDate(defaultDate)
    setNextStep(defaultNextStep ?? null)
    setNextStepDate(defaultNextStepDate)
    setNextStepTime("09:00")
    setScheduleQueue(false)
    setQueueEntryType("agendamento")
    setTruckPlate("")
    setDriverName("")
    setErrors({})
  }

  function handleOpenChange(open: boolean) {
    if (open) resetForm()
    onOpenChange(open)
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {}

    if (!contactType) newErrors.contactType = "Selecione o tipo de contato"
    if (!result) newErrors.result = "Selecione o resultado"

    if (result === "atendeu" && !notes.trim()) {
      newErrors.notes = "Notas são obrigatórias quando o contato atendeu"
    }

    if (loadPromised) {
      const vol = Number(promisedVolume)
      if (!vol || vol < 1) newErrors.promisedVolume = "Mínimo 1 carga"
      if (!promisedDate) {
        newErrors.promisedDate = "Data prevista é obrigatória"
      } else {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        if (promisedDate < today) {
          newErrors.promisedDate = "Data deve ser hoje ou futura"
        }
      }
    }

    if (nextStep === "retornar_em") {
      if (!nextStepDate) {
        newErrors.nextStepDate = "Data de retorno é obrigatória"
      } else {
        const returnDateTime = new Date(nextStepDate)
        const [hours, minutes] = nextStepTime.split(":").map(Number)
        returnDateTime.setHours(hours, minutes, 0, 0)
        if (returnDateTime <= new Date()) {
          newErrors.nextStepDate = "Data/hora deve ser futura"
        }
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return
    if (!contactType || !result) return

    setLoading(true)
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      toast.error("Sessão expirada. Faça login novamente.")
      setLoading(false)
      return
    }

    let nextStepDateTime: string | null = null
    if (nextStep === "retornar_em" && nextStepDate) {
      const dt = new Date(nextStepDate)
      const [hours, minutes] = nextStepTime.split(":").map(Number)
      dt.setHours(hours, minutes, 0, 0)
      nextStepDateTime = dt.toISOString()
    }

    const payload = {
      supplier_id: supplierId,
      organization_id: organizationId,
      user_id: user.id,
      contact_type: contactType,
      result,
      notes: notes.trim() || null,
      next_step: nextStep ?? "nenhum",
      next_step_date: nextStepDateTime,
      load_promised: loadPromised,
      promised_volume: loadPromised ? Number(promisedVolume) : null,
      promised_date: loadPromised && promisedDate
        ? format(promisedDate, "yyyy-MM-dd")
        : null,
    }

    const { data: insertedData, error } = await supabase
      .from("interactions")
      .insert(payload)
      .select("id")
      .single()

    if (error) {
      toast.error("Erro ao registrar interação.")
      setLoading(false)
      return
    }

    // Link AI suggestion if present
    if (suggestionId && insertedData) {
      await supabase
        .from("ai_suggestions")
        .update({
          status: "accepted",
          interaction_id: insertedData.id,
          accepted_at: new Date().toISOString(),
        })
        .eq("id", suggestionId)
      onSuggestionLinked?.(insertedData.id)
    }

    // Create queue entry if requested
    if (scheduleQueue && loadPromised && promisedDate) {
      const { error: queueError } = await supabase
        .from("queue_entries")
        .insert({
          organization_id: organizationId,
          supplier_id: supplierId,
          entry_type: queueEntryType,
          truck_plate: truckPlate || null,
          driver_name: driverName || null,
          estimated_volume_mdc: Number(promisedVolume),
          scheduled_date: format(promisedDate, "yyyy-MM-dd"),
          status: "aguardando" as const,
          created_by: user.id,
        })

      if (queueError) {
        toast.error("Interação registrada, mas erro ao agendar na fila.")
        setLoading(false)
        onOpenChange(false)
        onSuccess()
        return
      }
    }

    // Log activity
    logActivity({
      supabase,
      eventType: "interaction_registered",
      userId: user.id,
      supplierId,
      interactionId: insertedData?.id,
      title: supplierName,
      subtitle: `${contactTypeLabels[contactType!]} — ${contactResultLabels[result!]}`,
      metadata: { contact_type: contactType, result, load_promised: loadPromised, promised_volume: loadPromised ? Number(promisedVolume) : null },
    })

    toast.success(
      scheduleQueue && loadPromised
        ? "Interação registrada e carga agendada!"
        : "Interação registrada!"
    )
    setLoading(false)
    onOpenChange(false)
    onSuccess()
  }

  const contactTypes = Object.entries(contactTypeLabels) as [ContactType, string][]
  const results = Object.entries(contactResultLabels) as [ContactResult, string][]

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova interação</DialogTitle>
          <p className="text-sm text-muted-foreground">{supplierName}</p>
        </DialogHeader>

        <div className="space-y-6">
          {/* Step 1: Contact Type */}
          <div className="space-y-2">
            <Label>Tipo de contato *</Label>
            <div className="grid grid-cols-2 gap-2">
              {contactTypes.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setContactType(key)
                    setErrors((e) => ({ ...e, contactType: "" }))
                  }}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
                    contactType === key
                      ? "border-[#1B4332] bg-[#E8F5E9] text-[#1B4332]"
                      : "border-border hover:bg-muted"
                  )}
                >
                  <span>{contactTypeIcons[key]}</span>
                  {label}
                </button>
              ))}
            </div>
            {errors.contactType && (
              <p className="text-xs text-destructive">{errors.contactType}</p>
            )}
          </div>

          {/* Step 1: Result */}
          <div className="space-y-2">
            <Label>Resultado *</Label>
            <div className="grid grid-cols-2 gap-2">
              {results.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setResult(key)
                    setErrors((e) => ({ ...e, result: "" }))
                    if (key !== "atendeu") {
                      setLoadPromised(false)
                    }
                  }}
                  className={cn(
                    "rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
                    result === key
                      ? "border-[#1B4332] bg-[#E8F5E9] text-[#1B4332]"
                      : "border-border hover:bg-muted"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            {errors.result && (
              <p className="text-xs text-destructive">{errors.result}</p>
            )}
          </div>

          {/* Step 2: Conditional fields after result is selected */}
          {result && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
              {/* Notes */}
              <div className="space-y-2">
                <Label>
                  Notas {result === "atendeu" ? "*" : "(opcional)"}
                </Label>
                <Textarea
                  value={notes}
                  onChange={(e) => {
                    setNotes(e.target.value)
                    setErrors((prev) => ({ ...prev, notes: "" }))
                  }}
                  placeholder={
                    result === "atendeu"
                      ? "Descreva o que foi conversado..."
                      : "Observações adicionais..."
                  }
                  rows={3}
                  className={cn(errors.notes && "border-destructive")}
                />
                {errors.notes && (
                  <p className="text-xs text-destructive">{errors.notes}</p>
                )}
              </div>

              {/* Load promised - only when "atendeu" */}
              {result === "atendeu" && (
                <div className="space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={loadPromised}
                      onChange={(e) => setLoadPromised(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 accent-[#1B4332]"
                    />
                    <span className="text-sm font-medium">Carga prometida?</span>
                  </label>

                  {loadPromised && (
                    <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label>Quantidade (cargas)</Label>
                          <Input
                            type="number"
                            value={promisedVolume}
                            onChange={(e) => {
                              setPromisedVolume(e.target.value)
                              setErrors((prev) => ({ ...prev, promisedVolume: "" }))
                            }}
                            min={1}
                            className={cn(errors.promisedVolume && "border-destructive")}
                          />
                          {errors.promisedVolume && (
                            <p className="text-xs text-destructive">
                              {errors.promisedVolume}
                            </p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label>Data prevista</Label>
                          <Popover>
                            <PopoverTrigger
                              className={cn(
                                "flex h-9 w-full items-center justify-between rounded-md border bg-transparent px-3 py-1 text-sm",
                                errors.promisedDate && "border-destructive",
                                !promisedDate && "text-muted-foreground"
                              )}
                            >
                              {promisedDate
                                ? format(promisedDate, "dd/MM/yyyy")
                                : "Selecionar"}
                              <CalendarIcon className="h-4 w-4 opacity-50" />
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={promisedDate}
                                onSelect={(date) => {
                                  setPromisedDate(date ?? undefined)
                                  setErrors((prev) => ({ ...prev, promisedDate: "" }))
                                }}
                                disabled={{ before: new Date() }}
                                locale={ptBR}
                              />
                            </PopoverContent>
                          </Popover>
                          {errors.promisedDate && (
                            <p className="text-xs text-destructive">
                              {errors.promisedDate}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Schedule queue entry */}
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={scheduleQueue}
                          onChange={(e) => setScheduleQueue(e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 accent-[#1B4332]"
                        />
                        <span className="text-sm font-medium">Adicionar à fila de descargas?</span>
                      </label>

                      {scheduleQueue && (
                        <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                          <div className="flex gap-2">
                            {(["fila", "agendamento"] as const).map((type) => (
                              <button
                                key={type}
                                type="button"
                                onClick={() => setQueueEntryType(type)}
                                className={cn(
                                  "flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                                  queueEntryType === type
                                    ? "bg-[#1B4332] text-white"
                                    : "bg-white border border-border hover:bg-muted"
                                )}
                              >
                                {type === "fila" ? "Fila" : "Agendamento"}
                              </button>
                            ))}
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <Label>Placa do caminhão (opcional)</Label>
                              <Input
                                type="text"
                                value={truckPlate}
                                onChange={(e) => setTruckPlate(e.target.value)}
                                placeholder="ex: ABC1D23"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Motorista (opcional)</Label>
                              <Input
                                type="text"
                                value={driverName}
                                onChange={(e) => setDriverName(e.target.value)}
                                placeholder="Nome do motorista"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Info for "não atendeu" */}
              {result === "nao_atendeu" && (
                <div className="rounded-lg bg-[#E8F5E9] border border-blue-200 p-3 flex items-start gap-2">
                  <Info className="h-4 w-4 text-[#1B4332] mt-0.5 shrink-0" />
                  <p className="text-sm text-blue-800">
                    Fornecedor não atendeu. Deseja agendar um retorno abaixo?
                  </p>
                </div>
              )}

              {/* Step 3: Next step */}
              <div className="space-y-3">
                <Label>Próximo passo</Label>
                <div className="space-y-2">
                  {(
                    [
                      ["retornar_em", "Retornar em (data/hora)"],
                      ["aguardar_retorno", "Aguardar retorno do fornecedor"],
                      ["nenhum", "Nenhum"],
                    ] as [NextStepType, string][]
                  ).map(([key, label]) => (
                    <label
                      key={key}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors",
                        nextStep === key
                          ? "border-[#1B4332] bg-[#E8F5E9] text-[#1B4332]"
                          : "border-border hover:bg-muted"
                      )}
                    >
                      <input
                        type="radio"
                        name="nextStep"
                        value={key}
                        checked={nextStep === key}
                        onChange={() => setNextStep(key)}
                        className="accent-[#1B4332]"
                      />
                      <span className="text-sm font-medium">{label}</span>
                    </label>
                  ))}
                </div>

                {/* DateTime picker for "retornar_em" */}
                {nextStep === "retornar_em" && (
                  <div className="grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="space-y-2">
                      <Label>Data</Label>
                      <Popover>
                        <PopoverTrigger
                          className={cn(
                            "flex h-9 w-full items-center justify-between rounded-md border bg-transparent px-3 py-1 text-sm",
                            errors.nextStepDate && "border-destructive",
                            !nextStepDate && "text-muted-foreground"
                          )}
                        >
                          {nextStepDate
                            ? format(nextStepDate, "dd/MM/yyyy")
                            : "Selecionar"}
                          <CalendarIcon className="h-4 w-4 opacity-50" />
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={nextStepDate}
                            onSelect={(date) => {
                              setNextStepDate(date ?? undefined)
                              setErrors((prev) => ({ ...prev, nextStepDate: "" }))
                            }}
                            disabled={{ before: new Date() }}
                            locale={ptBR}
                          />
                        </PopoverContent>
                      </Popover>
                      {errors.nextStepDate && (
                        <p className="text-xs text-destructive">
                          {errors.nextStepDate}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Horário</Label>
                      <Input
                        type="time"
                        value={nextStepTime}
                        onChange={(e) => setNextStepTime(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {/* Auto alert info */}
                {result === "nao_atendeu" && nextStep === "nenhum" && (
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 flex items-start gap-2 animate-in fade-in duration-200">
                    <Info className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                    <p className="text-sm text-amber-800">
                      Um lembrete automático será criado para retornar em 2 horas.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="bg-[#1B4332] hover:bg-[#2D6A4F]"
              disabled={loading || !contactType || !result}
              onClick={handleSubmit}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Registrar interação
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
