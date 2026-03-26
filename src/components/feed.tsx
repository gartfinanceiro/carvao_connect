"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { ChevronDown, ChevronRight } from "lucide-react"
import { toast } from "sonner"
import { AlertCard, type AlertWithSupplier } from "@/components/alert-card"
import { AiSuggestionCard, type SuggestionWithSupplier } from "@/components/ai-suggestion-card"
import { InteractionForm } from "@/components/interaction-form"
import { SupplierForm } from "@/components/supplier-form"
import { QuickInteraction } from "@/components/quick-interaction"
import { DischargeForm } from "@/components/discharge-form"
import { EmptyState } from "@/components/empty-state"
import { ActivityFeed } from "@/components/activity-feed"
import { QueueForm } from "@/components/queue-form"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MessageSquare, UserPlus, Phone, CalendarClock, Truck, ChevronRight as ChevronRightIcon, XCircle } from "lucide-react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { convertVolume, unitLabel } from "@/lib/utils"
import type { VolumeUnit } from "@/lib/utils"
import { UnitToggle } from "@/components/unit-toggle"
import type { ContactType, ContactResult, NextStepType } from "@/types/database"

interface FeedProps {
  userName: string
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return "Bom dia"
  if (hour < 18) return "Boa tarde"
  return "Boa noite"
}

export function Feed({ userName }: FeedProps) {
  const [overdue, setOverdue] = useState<AlertWithSupplier[]>([])
  const [todayAlerts, setTodayAlerts] = useState<AlertWithSupplier[]>([])
  const [upcoming, setUpcoming] = useState<AlertWithSupplier[]>([])
  const [doneToday, setDoneToday] = useState<AlertWithSupplier[]>([])
  const [loading, setLoading] = useState(true)
  const [doneExpanded, setDoneExpanded] = useState(false)

  // KPI data
  const [queueToday, setQueueToday] = useState(0)
  const [queueWeek, setQueueWeek] = useState(0)
  const [dischargesWeekVolume, setDischargesWeekVolume] = useState(0)
  const [dischargesMonthVolume, setDischargesMonthVolume] = useState(0)
  const [dischargesWeekRaw, setDischargesWeekRaw] = useState<{ volume_mdc: number; density_kg_mdc: number | null }[]>([])
  const [dischargesMonthRaw, setDischargesMonthRaw] = useState<{ volume_mdc: number; density_kg_mdc: number | null }[]>([])
  const [unit, setUnit] = useState<VolumeUnit>("mdc")
  const [totalPendingAlerts, setTotalPendingAlerts] = useState(0)

  // Pipeline
  const [pipeline, setPipeline] = useState({ prometidas: 0, agendadas: 0, entregues: 0, canceladas: 0, adiadas: 0, pendentes: 0 })
  const [cancelledLoads, setCancelledLoads] = useState<Array<{ supplier_name: string; reason: string | null; date: string }>>([])

  // Interaction form
  const [interactionOpen, setInteractionOpen] = useState(false)
  const [selectedAlert, setSelectedAlert] = useState<AlertWithSupplier | null>(null)

  // Discharge form
  const [dischargeOpen, setDischargeOpen] = useState(false)
  const [dischargeSupplierId, setDischargeSupplierId] = useState<string | undefined>()
  const [dischargeInteractionId, setDischargeInteractionId] = useState<string | undefined>()

  // Quick action dialogs
  const [supplierFormOpen, setSupplierFormOpen] = useState(false)
  const [quickInteractionOpen, setQuickInteractionOpen] = useState(false)
  const [quickDischargeOpen, setQuickDischargeOpen] = useState(false)
  const [quickQueueOpen, setQuickQueueOpen] = useState(false)

  // Schedule queue from alert
  const [scheduleQueueOpen, setScheduleQueueOpen] = useState(false)
  const [scheduleAlert, setScheduleAlert] = useState<AlertWithSupplier | null>(null)

  // Cancel load dialog
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [cancelAlert, setCancelAlert] = useState<AlertWithSupplier | null>(null)
  const [cancelReason, setCancelReason] = useState("Fornecedor desistiu")
  const [cancelCustomReason, setCancelCustomReason] = useState("")
  const [cancelNotes, setCancelNotes] = useState("")

  // Postpone load dialog
  const [postponeDialogOpen, setPostponeDialogOpen] = useState(false)
  const [postponeAlert, setPostponeAlert] = useState<AlertWithSupplier | null>(null)
  const [postponeDate, setPostponeDate] = useState("")

  // Activity feed refresh
  const [activityRefreshKey, setActivityRefreshKey] = useState(0)

  // AI Suggestions
  const [suggestions, setSuggestions] = useState<SuggestionWithSupplier[]>([])
  const [suggestionFormOpen, setSuggestionFormOpen] = useState(false)
  const [activeSuggestion, setActiveSuggestion] = useState<SuggestionWithSupplier | null>(null)
  const [formDefaults, setFormDefaults] = useState<{
    supplierId: string
    supplierName: string
    organizationId: string
    contactType?: ContactType
    result?: ContactResult
    notes?: string
    loadPromised?: boolean
    volume?: string
    date?: Date
    nextStep?: NextStepType
    nextStepDate?: Date
    suggestionId?: string
  } | null>(null)

  const fetchAlerts = useCallback(async () => {
    const supabase = createClient()
    const now = new Date()
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)
    const tomorrowStart = new Date(todayStart)
    tomorrowStart.setDate(tomorrowStart.getDate() + 1)
    const in7days = new Date(todayStart)
    in7days.setDate(in7days.getDate() + 7)

    const weekStart = new Date(todayStart)
    weekStart.setDate(weekStart.getDate() - weekStart.getDay())
    const weekStartStr = weekStart.toISOString().split("T")[0]
    const weekEndDate = new Date(weekStart)
    weekEndDate.setDate(weekEndDate.getDate() + 6)
    const weekEndStr = weekEndDate.toISOString().split("T")[0]
    const todayDateStr = todayStart.toISOString().split("T")[0]
    const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1)
    const monthStartStr = monthStart.toISOString().split("T")[0]
    const monthStartISO = monthStart.toISOString()

    const [pendingResult, doneResult, queueTodayResult, queueWeekResult, dischargesWeekResult, dischargesMonthResult, suggestionsResult, pipelineResult, cancelledResult] = await Promise.all([
      supabase
        .from("alerts")
        .select("*, supplier:suppliers (id, name, phones)")
        .in("status", ["pendente"])
        .order("due_at", { ascending: true }),
      supabase
        .from("alerts")
        .select("*, supplier:suppliers (id, name, phones)")
        .eq("status", "concluido")
        .gte("updated_at", todayStart.toISOString())
        .order("updated_at", { ascending: false })
        .limit(20),
      supabase
        .from("queue_entries")
        .select("id", { count: "exact", head: true })
        .eq("scheduled_date", todayDateStr)
        .neq("status", "cancelado"),
      supabase
        .from("queue_entries")
        .select("id", { count: "exact", head: true })
        .gte("scheduled_date", weekStartStr)
        .lte("scheduled_date", weekEndStr)
        .neq("status", "cancelado"),
      supabase
        .from("discharges")
        .select("volume_mdc, density_kg_mdc")
        .gte("discharge_date", weekStartStr)
        .lte("discharge_date", todayDateStr),
      supabase
        .from("discharges")
        .select("volume_mdc, density_kg_mdc")
        .gte("discharge_date", monthStartStr)
        .lte("discharge_date", todayDateStr),
      supabase
        .from("ai_suggestions")
        .select("*, supplier:suppliers (id, name), conversation:whatsapp_conversations (id, phone)")
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      // Pipeline: interactions with load_promised this month
      supabase
        .from("interactions")
        .select("promised_status")
        .eq("load_promised", true)
        .gte("created_at", monthStartISO),
      // Cancelled loads (recent 5)
      supabase
        .from("interactions")
        .select("promised_cancel_reason, created_at, supplier:suppliers(name)")
        .eq("promised_status", "cancelada")
        .order("created_at", { ascending: false })
        .limit(5),
    ])

    const allPending = (pendingResult.data as AlertWithSupplier[]) ?? []

    const overdueAlerts: AlertWithSupplier[] = []
    const todayList: AlertWithSupplier[] = []
    const upcomingList: AlertWithSupplier[] = []

    for (const alert of allPending) {
      const dueAt = new Date(alert.due_at)
      if (dueAt < todayStart) {
        overdueAlerts.push(alert)
      } else if (dueAt < tomorrowStart) {
        todayList.push(alert)
      } else if (dueAt < in7days) {
        upcomingList.push(alert)
      }
    }

    setOverdue(overdueAlerts)
    setTodayAlerts(todayList)
    setUpcoming(upcomingList)
    setDoneToday((doneResult.data as AlertWithSupplier[]) ?? [])
    setQueueToday(queueTodayResult.count ?? 0)
    setQueueWeek(queueWeekResult.count ?? 0)
    const weekRaw = (dischargesWeekResult.data ?? []).map((d: { volume_mdc: number; density_kg_mdc: number | null }) => ({
      volume_mdc: Number(d.volume_mdc),
      density_kg_mdc: d.density_kg_mdc,
    }))
    const monthRaw = (dischargesMonthResult.data ?? []).map((d: { volume_mdc: number; density_kg_mdc: number | null }) => ({
      volume_mdc: Number(d.volume_mdc),
      density_kg_mdc: d.density_kg_mdc,
    }))
    setDischargesWeekRaw(weekRaw)
    setDischargesMonthRaw(monthRaw)
    setDischargesWeekVolume(
      weekRaw.reduce((sum: number, d) => sum + d.volume_mdc, 0)
    )
    setDischargesMonthVolume(
      monthRaw.reduce((sum: number, d) => sum + d.volume_mdc, 0)
    )
    setSuggestions((suggestionsResult.data as SuggestionWithSupplier[]) ?? [])
    setTotalPendingAlerts(allPending.length)

    // Pipeline — map DB enum values (singular) to display counts (plural)
    const pipeData = (pipelineResult.data ?? []) as Array<{ promised_status: string | null }>
    const pipeTotal = pipeData.length
    const pipeCounts = { prometidas: pipeTotal, agendadas: 0, entregues: 0, canceladas: 0, adiadas: 0, pendentes: 0 }
    for (const p of pipeData) {
      const st = p.promised_status ?? "pendente"
      if (st === "pendente") pipeCounts.pendentes++
      else if (st === "agendada") pipeCounts.agendadas++
      else if (st === "entregue") pipeCounts.entregues++
      else if (st === "cancelada") pipeCounts.canceladas++
      else if (st === "adiada") pipeCounts.adiadas++
    }
    setPipeline(pipeCounts)

    // Cancelled loads
    const cancelled = (cancelledResult.data ?? []) as Array<{
      promised_cancel_reason: string | null; created_at: string; supplier: unknown
    }>
    setCancelledLoads(cancelled.map(c => {
      const sup = c.supplier as { name: string } | { name: string }[] | null
      const name = Array.isArray(sup) ? sup[0]?.name : sup?.name
      return { supplier_name: name ?? "Fornecedor", reason: c.promised_cancel_reason, date: c.created_at }
    }))

    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAlerts()
  }, [fetchAlerts])

  function handleContact(alert: AlertWithSupplier) {
    setSelectedAlert(alert)
    setInteractionOpen(true)
  }

  async function handleSnooze(alertId: string) {
    const supabase = createClient()
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(9, 0, 0, 0)

    const { error } = await supabase
      .from("alerts")
      .update({
        status: "adiado",
        snoozed_until: tomorrow.toISOString(),
      })
      .eq("id", alertId)

    if (error) {
      toast.error("Erro ao adiar alerta.")
      return
    }
    toast.success("Alerta adiado para amanhã")
    fetchAlerts()
  }

  async function handleDismiss(alertId: string, reason: string) {
    const supabase = createClient()
    const { error } = await supabase
      .from("alerts")
      .update({
        status: "descartado",
        dismissed_reason: reason,
      })
      .eq("id", alertId)

    if (error) {
      toast.error("Erro ao descartar alerta.")
      return
    }
    toast.success("Alerta descartado")
    fetchAlerts()
  }

  async function handleInteractionSuccess() {
    if (selectedAlert) {
      const supabase = createClient()
      await supabase
        .from("alerts")
        .update({ status: "concluido" })
        .eq("id", selectedAlert.id)
      toast.success("Alerta concluído")
    }
    fetchAlerts()
    setActivityRefreshKey((k) => k + 1)
  }

  function handleRegisterDischarge(supplierId: string, interactionId?: string) {
    setDischargeSupplierId(supplierId)
    setDischargeInteractionId(interactionId)
    setDischargeOpen(true)
  }

  function handleDischargeSuccess() {
    fetchAlerts()
    setActivityRefreshKey((k) => k + 1)
  }

  function handleScheduleQueue(alert: AlertWithSupplier) {
    setScheduleAlert(alert)
    setScheduleQueueOpen(true)
  }

  async function handleScheduleQueueSuccess() {
    if (scheduleAlert) {
      const supabase = createClient()
      // Mark alert as done
      await supabase.from("alerts").update({ status: "concluido" }).eq("id", scheduleAlert.id)
      // Mark interaction as scheduled
      if (scheduleAlert.interaction_id) {
        await supabase.from("interactions").update({
          promised_status: "agendada",
        }).eq("id", scheduleAlert.interaction_id)
      }
    }
    setScheduleQueueOpen(false)
    setScheduleAlert(null)
    fetchAlerts()
    setActivityRefreshKey((k) => k + 1)
    toast.success("Carga agendada na fila!")
  }

  function handleCancelLoad(alert: AlertWithSupplier) {
    setCancelAlert(alert)
    setCancelReason("Fornecedor desistiu")
    setCancelCustomReason("")
    setCancelNotes("")
    setCancelDialogOpen(true)
  }

  async function handleConfirmCancel() {
    if (!cancelAlert) return
    const finalReason = cancelReason === "Outro" ? (cancelCustomReason.trim() || "Outro") : cancelReason
    const fullReason = cancelNotes.trim()
      ? `${finalReason}. Obs: ${cancelNotes.trim()}`
      : finalReason

    if (cancelReason === "Outro" && !cancelCustomReason.trim()) {
      toast.error("Informe o motivo do cancelamento.")
      return
    }

    const supabase = createClient()
    await supabase.from("alerts").update({
      status: "descartado",
      dismissed_reason: fullReason,
    }).eq("id", cancelAlert.id)
    if (cancelAlert.interaction_id) {
      await supabase.from("interactions").update({
        promised_status: "cancelada",
        promised_cancel_reason: fullReason,
      }).eq("id", cancelAlert.interaction_id)
    }
    setCancelDialogOpen(false)
    setCancelAlert(null)
    fetchAlerts()
    setActivityRefreshKey((k) => k + 1)
    toast.success("Carga marcada como cancelada")
  }

  function handlePostponeLoad(alert: AlertWithSupplier) {
    setPostponeAlert(alert)
    const next = new Date()
    next.setDate(next.getDate() + 7)
    setPostponeDate(next.toISOString().slice(0, 10))
    setPostponeDialogOpen(true)
  }

  async function handleConfirmPostpone() {
    if (!postponeAlert || !postponeDate) return
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Mark current interaction as postponed
    if (postponeAlert.interaction_id) {
      await supabase.from("interactions").update({
        promised_status: "adiada",
      }).eq("id", postponeAlert.interaction_id)
    }

    // Get original interaction data
    let origVolume = 1
    let origContactType: ContactType = "whatsapp"
    if (postponeAlert.interaction_id) {
      const { data: orig } = await supabase
        .from("interactions")
        .select("promised_volume, contact_type")
        .eq("id", postponeAlert.interaction_id)
        .single()
      if (orig) {
        origVolume = orig.promised_volume || 1
        origContactType = orig.contact_type as ContactType
      }
    }

    // Get org_id
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single()

    if (!profile?.organization_id || !postponeAlert.supplier) return

    const oldDateFormatted = postponeAlert.description?.match(/\d{2}\/\d{2}\/\d{4}/)?.[0] || "—"
    const newDateFormatted = new Date(postponeDate + "T12:00:00").toLocaleDateString("pt-BR")

    // Create new interaction with new promised date (trigger will create new alert)
    await supabase.from("interactions").insert({
      supplier_id: postponeAlert.supplier.id,
      organization_id: profile.organization_id,
      user_id: user.id,
      contact_type: origContactType,
      result: "atendeu" as ContactResult,
      notes: `Carga adiada de ${oldDateFormatted} para ${newDateFormatted}`,
      next_step: "nenhum",
      load_promised: true,
      promised_volume: origVolume,
      promised_date: postponeDate,
      promised_status: "pendente",
    })

    // Resolve current alert
    await supabase.from("alerts").update({ status: "concluido" }).eq("id", postponeAlert.id)

    setPostponeDialogOpen(false)
    setPostponeAlert(null)
    fetchAlerts()
    setActivityRefreshKey((k) => k + 1)
    toast.success("Carga adiada — novo alerta criado")
  }

  function buildFormDefaults(s: SuggestionWithSupplier) {
    const result = s.contact_result === "atendeu" || s.contact_result === "nao_atendeu"
      ? s.contact_result as ContactResult
      : "atendeu" as ContactResult
    const nextStep = s.next_step === "retornar_em" || s.next_step === "aguardar_retorno" || s.next_step === "nenhum"
      ? s.next_step as NextStepType
      : undefined

    setFormDefaults({
      supplierId: s.supplier?.id ?? "",
      supplierName: s.supplier?.name ?? "Fornecedor",
      organizationId: s.organization_id,
      contactType: "whatsapp" as ContactType,
      result,
      notes: s.summary ?? "",
      loadPromised: s.load_promised ?? false,
      volume: s.promised_volume ? String(s.promised_volume) : "1",
      date: s.promised_date ? new Date(s.promised_date + "T12:00:00") : undefined,
      nextStep,
      nextStepDate: s.next_step_date ? new Date(s.next_step_date) : undefined,
      suggestionId: s.id,
    })
  }

  function handleSuggestionConfirm(s: SuggestionWithSupplier) {
    setActiveSuggestion(s)
    buildFormDefaults(s)
    setSuggestionFormOpen(true)
  }

  function handleSuggestionEdit(s: SuggestionWithSupplier) {
    setActiveSuggestion(s)
    buildFormDefaults(s)
    setSuggestionFormOpen(true)
  }

  function handleSuggestionDismiss(suggestionId: string) {
    setSuggestions((prev) => prev.filter((s) => s.id !== suggestionId))
  }

  function handleSuggestionLinked() {
    if (activeSuggestion) {
      setSuggestions((prev) => prev.filter((s) => s.id !== activeSuggestion.id))
    }
    setActiveSuggestion(null)
    setFormDefaults(null)
    fetchAlerts()
    setActivityRefreshKey((k) => k + 1)
  }

  const todayDate = format(new Date(), "d 'de' MMMM, yyyy", { locale: ptBR })
  const firstName = userName.split(" ")[0]
  const hasAnyAlerts = overdue.length > 0 || todayAlerts.length > 0 || upcoming.length > 0

  // Active tab for alerts
  const [activeTab, setActiveTab] = useState<"overdue" | "today" | "upcoming" | "done">("overdue")

  // Auto-select first non-empty tab
  useEffect(() => {
    if (!loading) {
      if (overdue.length > 0) setActiveTab("overdue")
      else if (todayAlerts.length > 0) setActiveTab("today")
      else if (upcoming.length > 0) setActiveTab("upcoming")
      else if (doneToday.length > 0) setActiveTab("done")
    }
  }, [loading, overdue, todayAlerts, upcoming, doneToday])

  const activeAlerts = 
    activeTab === "overdue" ? overdue :
    activeTab === "today" ? todayAlerts :
    activeTab === "upcoming" ? upcoming :
    doneToday

  if (loading) {
    return (
      <div className="px-6 md:px-8 py-8 max-w-[1400px] space-y-6">
        <div className="space-y-2">
          <div className="h-8 w-64 bg-muted rounded-lg animate-pulse" />
          <div className="h-5 w-40 bg-muted rounded-lg animate-pulse" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-24 bg-muted rounded-2xl animate-pulse" />
          ))}
        </div>
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="h-64 bg-muted rounded-2xl animate-pulse" />
          <div className="h-64 bg-muted rounded-2xl animate-pulse" />
        </div>
      </div>
    )
  }

  return (
    <div className="px-6 md:px-8 py-8 max-w-[1400px]">
      {/* Greeting */}
      <div className="mb-8">
        <h1 className="text-[28px] font-extrabold tracking-tight text-foreground">
          {getGreeting()}, {firstName}
        </h1>
        <p className="text-[14px] text-muted-foreground mt-1">{todayDate}</p>
      </div>

      {/* Quick Actions Bar */}
      <div className="flex items-center gap-2 mb-6 mt-6 flex-wrap">
        <button
          onClick={() => setQuickInteractionOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1B4332] text-white text-[13px] font-semibold hover:bg-[#2D6A4F] active:scale-[0.97] transition-all duration-150"
        >
          <Phone className="h-4 w-4" />
          Registrar interação
        </button>
        <button
          onClick={() => setQuickQueueOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-[#E5E5E5] text-[#111] text-[13px] font-semibold hover:bg-[#F7F7F7] hover:border-[#999] active:scale-[0.97] transition-all duration-150"
        >
          <CalendarClock className="h-4 w-4" />
          Agendar fornecedor
        </button>
        <button
          onClick={() => setQuickDischargeOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-[#E5E5E5] text-[#111] text-[13px] font-semibold hover:bg-[#F7F7F7] hover:border-[#999] active:scale-[0.97] transition-all duration-150"
        >
          <Truck className="h-4 w-4" />
          Registrar descarga
        </button>
        <button
          onClick={() => setSupplierFormOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-[#E5E5E5] text-[#111] text-[13px] font-semibold hover:bg-[#F7F7F7] hover:border-[#999] active:scale-[0.97] transition-all duration-150"
        >
          <UserPlus className="h-4 w-4" />
          Novo fornecedor
        </button>
      </div>


      {/* ── Resumo Operacional ──────────────────────────────── */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground font-medium">Resumo operacional</span>
        <UnitToggle unit={unit} onChange={setUnit} />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {(() => {
          const weekVol = unit === "mdc"
            ? dischargesWeekVolume
            : dischargesWeekRaw.reduce((sum, d) => sum + convertVolume(d.volume_mdc, d.density_kg_mdc, unit), 0)
          const monthVol = unit === "mdc"
            ? dischargesMonthVolume
            : dischargesMonthRaw.reduce((sum, d) => sum + convertVolume(d.volume_mdc, d.density_kg_mdc, unit), 0)
          return [
            { label: "Cargas hoje", value: String(queueToday), sub: `${queueWeek} na semana`, color: "text-foreground" },
            { label: "Volume semana", value: (Math.round(weekVol * 10) / 10).toLocaleString("pt-BR"), sub: unitLabel(unit), color: "text-foreground" },
            { label: "Volume mês", value: (Math.round(monthVol * 10) / 10).toLocaleString("pt-BR"), sub: unitLabel(unit), color: "text-foreground" },
            { label: "Alertas pendentes", value: String(totalPendingAlerts), sub: overdue.length > 0 ? `${overdue.length} atrasados` : null as string | null, color: totalPendingAlerts > 0 ? "text-red-600" : "text-foreground" },
          ].map((stat) => (
            <div key={stat.label} className="p-5 rounded-2xl border border-border bg-white" style={{ boxShadow: "var(--shadow-card)" }}>
              <p className="text-[13px] font-medium text-muted-foreground">{stat.label}</p>
              <p className={`text-[36px] font-extrabold tracking-tight mt-1 leading-none ${stat.color}`}>
                {stat.value}
              </p>
              {stat.sub && <p className="text-[12px] text-muted-foreground mt-0.5">{stat.sub}</p>}
            </div>
          ))
        })()}
      </div>

      {/* ── Pipeline de Negociação ────────────────────────── */}
      {(() => {
        const monthNames = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"]
        const currentMonthName = monthNames[new Date().getMonth()]
        const prevMonthName = monthNames[(new Date().getMonth() - 1 + 12) % 12]

        const pct = (n: number) => pipeline.prometidas > 0 ? Math.round((n / pipeline.prometidas) * 100) : 0

        const pipeCards = [
          { label: "Prometidas", value: pipeline.prometidas, pct: null as number | null, color: "text-foreground" },
          { label: "Agendadas", value: pipeline.agendadas, pct: pct(pipeline.agendadas), color: "text-blue-600" },
          { label: "Entregues", value: pipeline.entregues, pct: pct(pipeline.entregues), color: "text-green-600" },
          { label: "Canceladas", value: pipeline.canceladas, pct: pct(pipeline.canceladas), color: "text-red-600" },
          { label: "Pendentes", value: pipeline.pendentes, pct: null, color: "text-amber-600" },
        ]

        return (
          <div className="mb-8">
            <span className="text-xs text-muted-foreground font-medium">Pipeline de negociação — {currentMonthName} {new Date().getFullYear()}</span>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mt-2">
              {pipeCards.map((card, i) => (
                <div key={card.label} className="relative p-5 rounded-2xl border border-border bg-white" style={{ boxShadow: "var(--shadow-card)" }}>
                  <p className="text-[13px] font-medium text-muted-foreground">{card.label}</p>
                  <p className={`text-[36px] font-extrabold tracking-tight mt-1 leading-none ${card.color}`}>
                    {card.value}
                  </p>
                  {card.pct !== null && <p className="text-[12px] text-muted-foreground mt-0.5">{card.pct}%</p>}
                  {i < 2 && (
                    <ChevronRightIcon className="hidden lg:block absolute -right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/30 z-10" />
                  )}
                </div>
              ))}
            </div>

            {/* Cancelled loads */}
            {cancelledLoads.length > 0 && (
              <div className="mt-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-muted-foreground font-medium">Negociações perdidas</p>
                  <Link href="/dashboard/negociacoes-perdidas" className="text-xs font-medium text-[#1B4332] hover:underline">
                    Ver todas →
                  </Link>
                </div>
                <div className="rounded-2xl border border-border bg-white overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
                  {cancelledLoads.map((c, i) => (
                    <div key={i} className={`flex items-center gap-3 px-4 py-2.5 text-[13px] ${i > 0 ? "border-t border-border/60" : ""}`}>
                      <XCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
                      <span className="font-medium text-foreground">{c.supplier_name}</span>
                      <span className="text-muted-foreground">—</span>
                      <span className="text-muted-foreground">{c.reason || "Sem motivo"}</span>
                      <span className="text-muted-foreground/60 ml-auto text-xs">
                        {new Date(c.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })()}

      {/* Two Column Layout */}
      <div className="grid lg:grid-cols-[1fr_1fr] gap-6">

        {/* LEFT: Actions with tabs */}
        <div>
          <h2 className="text-[16px] font-bold text-foreground mb-4">Ações pendentes</h2>

          {/* Tab buttons */}
          <div className="flex gap-2 mb-4">
            {([
              { key: "overdue" as const, label: "Atrasados", count: overdue.length, color: "bg-red-500" },
              { key: "today" as const, label: "Hoje", count: todayAlerts.length, color: "bg-amber-500" },
              { key: "upcoming" as const, label: "Próximos", count: upcoming.length, color: "bg-[#999]" },
              { key: "done" as const, label: "Concluídos", count: doneToday.length, color: "bg-emerald-500" },
            ]).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-[13px] font-semibold transition-all duration-150 ${
                  activeTab === tab.key
                    ? "bg-[#1B4332] text-white"
                    : "bg-white border border-[#E5E5E5] text-[#737373] hover:text-[#111] hover:border-[#999]"
                }`}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className={`text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 ${
                    activeTab === tab.key
                      ? "bg-white/20 text-white"
                      : `${tab.color} text-white`
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Alert list */}
          {activeAlerts.length === 0 ? (
            <div className="rounded-2xl border border-[#E5E5E5] bg-white p-8 text-center" style={{ boxShadow: "var(--shadow-card)" }}>
              <p className="text-[14px] text-[#999]">
                {activeTab === "done" ? "Nenhuma ação concluída hoje." : "Nenhuma ação pendente nesta categoria."}
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-[#E5E5E5] bg-white overflow-hidden max-h-[600px] overflow-y-auto" style={{ boxShadow: "var(--shadow-card)" }}>
              {activeAlerts.map((alert, i) => (
                <AlertCard
                  key={alert.id}
                  alert={alert}
                  section={activeTab}
                  onContact={handleContact}
                  onSnooze={handleSnooze}
                  onDismiss={handleDismiss}
                  onRegisterDischarge={handleRegisterDischarge}
                  onScheduleQueue={handleScheduleQueue}
                  onCancelLoad={handleCancelLoad}
                  onPostponeLoad={handlePostponeLoad}
                  isLast={i === activeAlerts.length - 1}
                />
              ))}
            </div>
          )}

          {/* AI Suggestions */}
          {suggestions.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center gap-2.5 mb-3">
                <MessageSquare className="h-4 w-4 text-[#1B4332]" />
                <h2 className="text-[16px] font-bold text-foreground">Sugestões da IA</h2>
                <span className="bg-[#1B4332] text-white text-[11px] font-bold rounded-full min-w-[22px] h-[22px] flex items-center justify-center px-1.5">
                  {suggestions.length}
                </span>
              </div>
              <div className="rounded-2xl border border-[#E5E5E5] bg-white overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
                {suggestions.map((s) => (
                  <AiSuggestionCard
                    key={s.id}
                    suggestion={s}
                    onConfirm={() => handleSuggestionConfirm(s)}
                    onEdit={() => handleSuggestionEdit(s)}
                    onDismiss={() => handleSuggestionDismiss(s.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Activity Timeline */}
        <div>
          <h2 className="text-[16px] font-bold text-foreground mb-4">Atividade recente</h2>
          <ActivityFeed refreshKey={activityRefreshKey} />
        </div>
      </div>

      {/* Dialogs */}
      {selectedAlert?.supplier && (
        <InteractionForm
          supplierId={selectedAlert.supplier.id}
          supplierName={selectedAlert.supplier.name}
          organizationId={selectedAlert.organization_id}
          open={interactionOpen}
          onOpenChange={setInteractionOpen}
          onSuccess={handleInteractionSuccess}
        />
      )}
      <DischargeForm
        open={dischargeOpen}
        onOpenChange={setDischargeOpen}
        supplierId={dischargeSupplierId}
        interactionId={dischargeInteractionId}
        onSuccess={handleDischargeSuccess}
      />
      {/* Quick action: New Interaction (select supplier first) */}
      <QuickInteraction
        open={quickInteractionOpen}
        onOpenChange={setQuickInteractionOpen}
        onSuccess={() => { fetchAlerts(); setActivityRefreshKey((k) => k + 1) }}
      />

      {/* Quick action: Schedule supplier */}
      <QueueForm
        open={quickQueueOpen}
        onOpenChange={setQuickQueueOpen}
        defaultType="agendamento"
        onSuccess={() => { fetchAlerts(); setActivityRefreshKey((k) => k + 1) }}
      />

      {/* Quick action: New Supplier */}
      <SupplierForm
        open={supplierFormOpen}
        onOpenChange={setSupplierFormOpen}
        onSuccess={fetchAlerts}
      />

      {/* Quick action: New Interaction (no pre-selected supplier) */}
      <DischargeForm
        open={quickDischargeOpen}
        onOpenChange={setQuickDischargeOpen}
        onSuccess={() => { fetchAlerts(); setActivityRefreshKey((k) => k + 1) }}
      />

      {formDefaults && (
        <InteractionForm
          supplierId={formDefaults.supplierId}
          supplierName={formDefaults.supplierName}
          organizationId={formDefaults.organizationId}
          open={suggestionFormOpen}
          onOpenChange={setSuggestionFormOpen}
          onSuccess={handleSuggestionLinked}
          defaultContactType={formDefaults.contactType}
          defaultResult={formDefaults.result}
          defaultNotes={formDefaults.notes}
          defaultLoadPromised={formDefaults.loadPromised}
          defaultVolume={formDefaults.volume}
          defaultDate={formDefaults.date}
          defaultNextStep={formDefaults.nextStep}
          defaultNextStepDate={formDefaults.nextStepDate}
          suggestionId={formDefaults.suggestionId}
        />
      )}

      {/* Schedule queue from load alert */}
      <QueueForm
        open={scheduleQueueOpen}
        onOpenChange={setScheduleQueueOpen}
        defaultType="agendamento"
        defaultSupplierId={scheduleAlert?.supplier?.id}
        onSuccess={handleScheduleQueueSuccess}
      />

      {/* Cancel load dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="max-w-md w-full">
          <DialogHeader>
            <DialogTitle>Carga cancelada</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Motivo do cancelamento</Label>
              <Select value={cancelReason} onValueChange={(v) => v && setCancelReason(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue>{(v: string) => v}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Fornecedor desistiu">Fornecedor desistiu</SelectItem>
                  <SelectItem value="Vendeu para outra siderúrgica">Vendeu para outra siderúrgica</SelectItem>
                  <SelectItem value="Problema na produção/transporte">Problema na produção/transporte</SelectItem>
                  <SelectItem value="Preço não acordado">Preço não acordado</SelectItem>
                  <SelectItem value="Outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {cancelReason === "Outro" && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Especifique o motivo *</Label>
                <Input
                  value={cancelCustomReason}
                  onChange={(e) => setCancelCustomReason(e.target.value)}
                  placeholder="Descreva o motivo..."
                  className="h-8 text-sm"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Observações</Label>
              <textarea
                value={cancelNotes}
                onChange={(e) => setCancelNotes(e.target.value)}
                placeholder="Informações adicionais (opcional)"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px] resize-y focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>Voltar</Button>
            <Button variant="destructive" onClick={handleConfirmCancel}>Confirmar cancelamento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Postpone load dialog */}
      <Dialog open={postponeDialogOpen} onOpenChange={setPostponeDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Adiar carga</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Selecione a nova data prevista de entrega:</p>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Nova data</Label>
              <Input
                type="date"
                value={postponeDate}
                onChange={(e) => setPostponeDate(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPostponeDialogOpen(false)}>Voltar</Button>
            <Button className="bg-[#1B4332] hover:bg-[#2D6A4F]" onClick={handleConfirmPostpone} disabled={!postponeDate}>
              Confirmar adiamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
