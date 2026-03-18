"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, ChevronDown, ChevronRight, AlertTriangle, Clock, Truck, Users } from "lucide-react"
import { toast } from "sonner"
import { AlertCard, type AlertWithSupplier } from "@/components/alert-card"
import { InteractionForm } from "@/components/interaction-form"
import { EmptyState } from "@/components/empty-state"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

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
  const [activeSuppliers, setActiveSuppliers] = useState(0)
  const [totalSuppliers, setTotalSuppliers] = useState(0)
  const [loadsNext7d, setLoadsNext7d] = useState(0)

  // Interaction form
  const [interactionOpen, setInteractionOpen] = useState(false)
  const [selectedAlert, setSelectedAlert] = useState<AlertWithSupplier | null>(null)

  const fetchAlerts = useCallback(async () => {
    const supabase = createClient()
    const now = new Date()
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)
    const tomorrowStart = new Date(todayStart)
    tomorrowStart.setDate(tomorrowStart.getDate() + 1)
    const in7days = new Date(todayStart)
    in7days.setDate(in7days.getDate() + 7)

    const [pendingResult, doneResult, suppliersResult, totalSuppliersResult, loadsResult] = await Promise.all([
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
        .from("suppliers")
        .select("id", { count: "exact", head: true })
        .eq("status", "ativo"),
      supabase
        .from("suppliers")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("interactions")
        .select("promised_volume")
        .eq("load_promised", true)
        .gte("promised_date", todayStart.toISOString().split("T")[0])
        .lte("promised_date", in7days.toISOString().split("T")[0]),
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
    setActiveSuppliers(suppliersResult.count ?? 0)
    setTotalSuppliers(totalSuppliersResult.count ?? 0)
    setLoadsNext7d(
      loadsResult.data?.reduce((sum, i) => sum + (i.promised_volume ?? 0), 0) ?? 0
    )
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

  const todayDate = format(new Date(), "d 'de' MMMM, yyyy", { locale: ptBR })
  const firstName = userName.split(" ")[0]
  const hasAnyAlerts = overdue.length > 0 || todayAlerts.length > 0 || upcoming.length > 0

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <div className="space-y-2">
          <div className="h-8 w-64 bg-muted rounded animate-pulse" />
          <div className="h-5 w-48 bg-muted rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h1 className="text-2xl font-bold">
          {getGreeting()}, {firstName}
        </h1>
        <p className="text-sm text-muted-foreground">{todayDate}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className={overdue.length > 0 ? "border-red-200 bg-red-50" : ""}>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className={`h-4 w-4 ${overdue.length > 0 ? "text-red-600" : "text-muted-foreground"}`} />
              <span className="text-xs text-muted-foreground">Atrasados</span>
            </div>
            <p className={`text-3xl font-bold ${overdue.length > 0 ? "text-red-600" : ""}`}>
              {overdue.length}
            </p>
            <p className="text-xs text-muted-foreground">precisam de atenção</p>
          </CardContent>
        </Card>

        <Card className={todayAlerts.length > 0 ? "border-amber-200 bg-amber-50" : ""}>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className={`h-4 w-4 ${todayAlerts.length > 0 ? "text-amber-600" : "text-muted-foreground"}`} />
              <span className="text-xs text-muted-foreground">Hoje</span>
            </div>
            <p className={`text-3xl font-bold ${todayAlerts.length > 0 ? "text-amber-600" : ""}`}>
              {todayAlerts.length}
            </p>
            <p className="text-xs text-muted-foreground">ações para hoje</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <Truck className="h-4 w-4 text-blue-600" />
              <span className="text-xs text-muted-foreground">Cargas 7d</span>
            </div>
            <p className="text-3xl font-bold text-blue-600">{loadsNext7d}</p>
            <p className="text-xs text-muted-foreground">cargas previstas</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-[#1B4332]" />
              <span className="text-xs text-muted-foreground">Fornecedores</span>
            </div>
            <p className="text-3xl font-bold text-[#1B4332]">{activeSuppliers}</p>
            <p className="text-xs text-muted-foreground">de {totalSuppliers} cadastrados</p>
          </CardContent>
        </Card>
      </div>

      {/* Alerts Feed */}
      {!hasAnyAlerts && doneToday.length === 0 && (
        <EmptyState
          icon="🎉"
          title="Nenhuma ação pendente"
          description="Ótimo trabalho! Não há alertas pendentes no momento."
          actionLabel="Ver fornecedores"
          actionHref="/fornecedores"
        />
      )}

      {/* Overdue */}
      {overdue.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="h-px flex-1 bg-red-200" />
            <span className="text-xs font-semibold text-red-600 uppercase tracking-wide px-2">
              Atrasados ({overdue.length})
            </span>
            <div className="h-px flex-1 bg-red-200" />
          </div>
          <div className="space-y-3">
            {overdue.map((alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                section="overdue"
                onContact={handleContact}
                onSnooze={handleSnooze}
                onDismiss={handleDismiss}
              />
            ))}
          </div>
        </section>
      )}

      {/* Today */}
      {todayAlerts.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="h-px flex-1 bg-amber-200" />
            <span className="text-xs font-semibold text-amber-600 uppercase tracking-wide px-2">
              Hoje ({todayAlerts.length})
            </span>
            <div className="h-px flex-1 bg-amber-200" />
          </div>
          <div className="space-y-3">
            {todayAlerts.map((alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                section="today"
                onContact={handleContact}
                onSnooze={handleSnooze}
                onDismiss={handleDismiss}
              />
            ))}
          </div>
        </section>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-2">
              Próximos ({upcoming.length})
            </span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>
          <div className="space-y-3">
            {upcoming.map((alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                section="upcoming"
                onContact={handleContact}
                onSnooze={handleSnooze}
                onDismiss={handleDismiss}
              />
            ))}
          </div>
        </section>
      )}

      {/* Done Today */}
      {doneToday.length > 0 && (
        <section>
          <button
            onClick={() => setDoneExpanded(!doneExpanded)}
            className="flex items-center gap-2 w-full mb-3"
          >
            <div className="h-px flex-1 bg-green-200" />
            <span className="text-xs font-semibold text-green-600 uppercase tracking-wide px-2 flex items-center gap-1">
              {doneExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              Concluídos hoje ({doneToday.length})
            </span>
            <div className="h-px flex-1 bg-green-200" />
          </button>
          {doneExpanded && (
            <div className="space-y-3">
              {doneToday.map((alert) => (
                <AlertCard
                  key={alert.id}
                  alert={alert}
                  section="done"
                  onContact={handleContact}
                  onSnooze={handleSnooze}
                  onDismiss={handleDismiss}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Interaction Form */}
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
    </div>
  )
}
