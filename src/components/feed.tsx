"use client"

import { useEffect, useState, useCallback } from "react"
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
import { MessageSquare, UserPlus, Phone, CalendarClock, Truck } from "lucide-react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
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
  const [loadsNext7d, setLoadsNext7d] = useState(0)
  const [dischargesWeekVolume, setDischargesWeekVolume] = useState(0)

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
    const todayDateStr = todayStart.toISOString().split("T")[0]

    const [pendingResult, doneResult, loadsResult, dischargesWeekResult, suggestionsResult] = await Promise.all([
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
        .from("interactions")
        .select("promised_volume")
        .eq("load_promised", true)
        .gte("promised_date", todayStart.toISOString().split("T")[0])
        .lte("promised_date", in7days.toISOString().split("T")[0]),
      supabase
        .from("discharges")
        .select("volume_mdc")
        .gte("discharge_date", weekStartStr)
        .lte("discharge_date", todayDateStr),
      supabase
        .from("ai_suggestions")
        .select("*, supplier:suppliers (id, name), conversation:whatsapp_conversations (id, phone)")
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
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
    setLoadsNext7d(
      loadsResult.data?.reduce((sum, i) => sum + (i.promised_volume ?? 0), 0) ?? 0
    )
    setDischargesWeekVolume(
      dischargesWeekResult.data?.reduce((sum, d) => sum + Number(d.volume_mdc), 0) ?? 0
    )
    setSuggestions((suggestionsResult.data as SuggestionWithSupplier[]) ?? [])
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
  }

  function handleRegisterDischarge(supplierId: string, interactionId?: string) {
    setDischargeSupplierId(supplierId)
    setDischargeInteractionId(interactionId)
    setDischargeOpen(true)
  }

  function handleDischargeSuccess() {
    fetchAlerts()
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
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


      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Atrasados", value: overdue.length, color: overdue.length > 0 ? "text-red-600" : "text-foreground" },
          { label: "Hoje", value: todayAlerts.length, color: todayAlerts.length > 0 ? "text-amber-600" : "text-foreground" },
          { label: "Cargas 7d", value: loadsNext7d, color: "text-foreground" },
          { label: "Descargas semana", value: dischargesWeekVolume.toLocaleString("pt-BR"), color: "text-foreground" },
        ].map((stat) => (
          <div key={stat.label} className="p-5 rounded-2xl border border-border bg-white" style={{ boxShadow: "var(--shadow-card)" }}>
            <p className="text-[13px] font-medium text-muted-foreground">{stat.label}</p>
            <p className={`text-[36px] font-extrabold tracking-tight mt-1 leading-none ${stat.color}`}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

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
          <ActivityFeed />
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
        onSuccess={fetchAlerts}
      />

      {/* Quick action: Schedule supplier */}
      <QueueForm
        open={quickQueueOpen}
        onOpenChange={setQuickQueueOpen}
        defaultType="agendamento"
        onSuccess={fetchAlerts}
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
        onSuccess={() => { fetchAlerts() }}
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
    </div>
  )
}
