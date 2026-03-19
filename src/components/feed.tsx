"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { ChevronDown, ChevronRight } from "lucide-react"
import { toast } from "sonner"
import { AlertCard, type AlertWithSupplier } from "@/components/alert-card"
import { AiSuggestionCard, type SuggestionWithSupplier } from "@/components/ai-suggestion-card"
import { InteractionForm } from "@/components/interaction-form"
import { DischargeForm } from "@/components/discharge-form"
import { EmptyState } from "@/components/empty-state"
import { MessageSquare } from "lucide-react"
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
        .select("*, supplier:suppliers (id, name, charcoal_type, phones)")
        .in("status", ["pendente"])
        .order("due_at", { ascending: true }),
      supabase
        .from("alerts")
        .select("*, supplier:suppliers (id, name, charcoal_type, phones)")
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
        .select("*, supplier:suppliers (id, name, charcoal_type), conversation:whatsapp_conversations (id, phone)")
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

  if (loading) {
    return (
      <div className="px-6 md:px-8 py-8 max-w-[1100px] space-y-6">
        <div className="space-y-2">
          <div className="h-8 w-64 bg-muted rounded-lg animate-pulse" />
          <div className="h-5 w-40 bg-muted rounded-lg animate-pulse" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-muted rounded-2xl animate-pulse" />
          ))}
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-muted rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="px-6 md:px-8 py-8 max-w-[1100px]">
      {/* Greeting */}
      <div className="mb-8">
        <h1 className="text-[28px] font-extrabold tracking-tight text-foreground">
          {getGreeting()}, {firstName}
        </h1>
        <p className="text-[14px] text-muted-foreground mt-1">{todayDate}</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
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

      {/* WhatsApp Suggestions */}
      {suggestions.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center gap-2.5 mb-3">
            <MessageSquare className="h-4 w-4 text-emerald-600" />
            <h2 className="text-[16px] font-bold text-foreground">Sugestões do WhatsApp</h2>
            <span className="bg-emerald-500 text-white text-[11px] font-bold rounded-full min-w-[22px] h-[22px] flex items-center justify-center px-1.5">
              {suggestions.length}
            </span>
          </div>
          <div className="rounded-2xl border border-border bg-white overflow-hidden divide-y divide-border" style={{ boxShadow: "var(--shadow-card)" }}>
            {suggestions.map((s) => (
              <AiSuggestionCard
                key={s.id}
                suggestion={s}
                onConfirm={handleSuggestionConfirm}
                onEdit={handleSuggestionEdit}
                onDismiss={handleSuggestionDismiss}
              />
            ))}
          </div>
        </section>
      )}

      {/* Alerts */}
      {!hasAnyAlerts && doneToday.length === 0 && suggestions.length === 0 && (
        <EmptyState
          icon="🎉"
          title="Nenhuma ação pendente"
          description="Ótimo trabalho! Não há alertas pendentes no momento."
          actionLabel="Ver fornecedores"
          actionHref="/fornecedores"
        />
      )}

      {overdue.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center gap-2.5 mb-3">
            <h2 className="text-[16px] font-bold text-foreground">Ações atrasadas</h2>
            <span className="bg-red-500 text-white text-[11px] font-bold rounded-full min-w-[22px] h-[22px] flex items-center justify-center px-1.5">
              {overdue.length}
            </span>
          </div>
          <div className="rounded-2xl border border-border bg-white overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
            {overdue.map((alert, i) => (
              <AlertCard key={alert.id} alert={alert} section="overdue" onContact={handleContact} onSnooze={handleSnooze} onDismiss={handleDismiss} onRegisterDischarge={handleRegisterDischarge} isLast={i === overdue.length - 1} />
            ))}
          </div>
        </section>
      )}

      {todayAlerts.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center gap-2.5 mb-3">
            <h2 className="text-[16px] font-bold text-foreground">Hoje</h2>
            <span className="bg-amber-500 text-white text-[11px] font-bold rounded-full min-w-[22px] h-[22px] flex items-center justify-center px-1.5">
              {todayAlerts.length}
            </span>
          </div>
          <div className="rounded-2xl border border-border bg-white overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
            {todayAlerts.map((alert, i) => (
              <AlertCard key={alert.id} alert={alert} section="today" onContact={handleContact} onSnooze={handleSnooze} onDismiss={handleDismiss} onRegisterDischarge={handleRegisterDischarge} isLast={i === todayAlerts.length - 1} />
            ))}
          </div>
        </section>
      )}

      {upcoming.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center gap-2.5 mb-3">
            <h2 className="text-[16px] font-bold text-foreground">Próximos</h2>
            <span className="bg-muted-foreground/30 text-foreground text-[11px] font-bold rounded-full min-w-[22px] h-[22px] flex items-center justify-center px-1.5">
              {upcoming.length}
            </span>
          </div>
          <div className="rounded-2xl border border-border bg-white overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
            {upcoming.map((alert, i) => (
              <AlertCard key={alert.id} alert={alert} section="upcoming" onContact={handleContact} onSnooze={handleSnooze} onDismiss={handleDismiss} onRegisterDischarge={handleRegisterDischarge} isLast={i === upcoming.length - 1} />
            ))}
          </div>
        </section>
      )}

      {doneToday.length > 0 && (
        <section className="mb-8">
          <button onClick={() => setDoneExpanded(!doneExpanded)} className="flex items-center gap-2.5 mb-3">
            {doneExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            <h2 className="text-[16px] font-bold text-foreground">Concluídos</h2>
            <span className="bg-emerald-500 text-white text-[11px] font-bold rounded-full min-w-[22px] h-[22px] flex items-center justify-center px-1.5">
              {doneToday.length}
            </span>
          </button>
          {doneExpanded && (
            <div className="rounded-2xl border border-border bg-white overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
              {doneToday.map((alert, i) => (
                <AlertCard key={alert.id} alert={alert} section="done" onContact={handleContact} onSnooze={handleSnooze} onDismiss={handleDismiss} onRegisterDischarge={handleRegisterDischarge} isLast={i === doneToday.length - 1} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
        <a href="/fornecedores" className="flex items-center gap-3 p-4 rounded-2xl border border-border bg-white hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-all duration-200" style={{ boxShadow: "var(--shadow-card)" }}>
          <span className="h-9 w-9 rounded-xl bg-[#E8F5E9] flex items-center justify-center text-[#1B4332] text-lg font-bold">+</span>
          <span className="text-[14px] font-semibold text-foreground">Novo fornecedor</span>
        </a>
        <a href="/descargas" className="flex items-center justify-between p-4 rounded-2xl border border-border bg-white hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-all duration-200" style={{ boxShadow: "var(--shadow-card)" }}>
          <div className="flex items-center gap-3">
            <span className="h-9 w-9 rounded-xl bg-[#E8F5E9] flex items-center justify-center text-lg">📦</span>
            <span className="text-[14px] font-semibold text-foreground">Descargas</span>
          </div>
          <span className="text-[13px] font-semibold text-[#1B4332]">Ver todas →</span>
        </a>
      </div>

      {selectedAlert?.supplier && (
        <InteractionForm supplierId={selectedAlert.supplier.id} supplierName={selectedAlert.supplier.name} organizationId={selectedAlert.organization_id} open={interactionOpen} onOpenChange={setInteractionOpen} onSuccess={handleInteractionSuccess} />
      )}
      <DischargeForm open={dischargeOpen} onOpenChange={setDischargeOpen} supplierId={dischargeSupplierId} interactionId={dischargeInteractionId} onSuccess={handleDischargeSuccess} />

      {/* Suggestion interaction form */}
      {formDefaults && (
        <InteractionForm
          supplierId={formDefaults.supplierId}
          supplierName={formDefaults.supplierName}
          organizationId={formDefaults.organizationId}
          open={suggestionFormOpen}
          onOpenChange={(open) => {
            setSuggestionFormOpen(open)
            if (!open) {
              setActiveSuggestion(null)
              setFormDefaults(null)
            }
          }}
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
          onSuggestionLinked={handleSuggestionLinked}
        />
      )}
    </div>
  )
}