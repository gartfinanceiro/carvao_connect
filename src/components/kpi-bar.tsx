import { createClient } from "@/lib/supabase/server"
import { Users, Bell, Package, Truck, MessageSquare } from "lucide-react"

export async function KpiBar() {
  const supabase = await createClient()

  const now = new Date()
  const endOfToday = new Date(now)
  endOfToday.setHours(23, 59, 59, 999)
  const todayStr = now.toISOString().split("T")[0]
  const in7days = new Date(now)
  in7days.setDate(in7days.getDate() + 7)
  const in7daysStr = in7days.toISOString().split("T")[0]
  const thirtyDaysAgo = new Date(now)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split("T")[0]

  const [suppliersResult, alertsResult, loadsResult, dischargesResult, whatsappResult, suggestionsResult] = await Promise.all([
    supabase
      .from("suppliers")
      .select("id", { count: "exact", head: true })
      .eq("status", "ativo"),
    supabase
      .from("alerts")
      .select("id", { count: "exact", head: true })
      .eq("status", "pendente")
      .lte("due_at", endOfToday.toISOString()),
    supabase
      .from("interactions")
      .select("promised_volume")
      .eq("load_promised", true)
      .gte("promised_date", todayStr)
      .lte("promised_date", in7daysStr),
    supabase
      .from("discharges")
      .select("volume_mdc")
      .gte("discharge_date", thirtyDaysAgoStr)
      .lte("discharge_date", todayStr),
    supabase
      .from("whatsapp_connections")
      .select("status")
      .maybeSingle(),
    supabase
      .from("ai_suggestions")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
  ])

  const activeSuppliers = suppliersResult.count ?? 0
  const pendingAlerts = alertsResult.count ?? 0
  const totalLoads = loadsResult.data?.reduce(
    (sum, i) => sum + (i.promised_volume ?? 0),
    0
  ) ?? 0
  const dischargesData = dischargesResult.data ?? []
  const dischargesVolume30d = dischargesData.reduce(
    (sum, d) => sum + Number(d.volume_mdc),
    0
  )
  const dischargesCount30d = dischargesData.length
  const whatsappStatus = whatsappResult.data?.status as string | undefined
  const isWhatsAppConnected = whatsappStatus === "connected"
  const pendingSuggestions = suggestionsResult.count ?? 0

  const kpis = [
    {
      label: "Fornecedores",
      value: activeSuppliers,
      icon: Users,
      iconBg: "bg-emerald-50",
      iconColor: "text-emerald-600",
    },
    {
      label: "Alertas",
      value: pendingAlerts,
      icon: Bell,
      iconBg: pendingAlerts > 0 ? "bg-red-50" : "bg-gray-50",
      iconColor: pendingAlerts > 0 ? "text-red-600" : "text-muted-foreground",
      valueColor: pendingAlerts > 0 ? "text-red-600" : undefined,
    },
    {
      label: "Cargas 7d",
      value: totalLoads,
      icon: Package,
      iconBg: "bg-amber-50",
      iconColor: "text-amber-600",
    },
    {
      label: "MDC 30d",
      value: dischargesVolume30d.toLocaleString("pt-BR"),
      icon: Truck,
      iconBg: "bg-[#E8F5E9]",
      iconColor: "text-[#1B4332]",
      suffix: `(${dischargesCount30d})`,
    },
    ...(whatsappStatus
      ? [
          {
            label: "WhatsApp",
            value: pendingSuggestions > 0 ? pendingSuggestions : (isWhatsAppConnected ? "On" : "Off"),
            icon: MessageSquare,
            iconBg: isWhatsAppConnected ? "bg-[#E8F5E9]" : "bg-red-50",
            iconColor: isWhatsAppConnected ? "text-[#34C759]" : "text-[#FF3B30]",
            valueColor: pendingSuggestions > 0 ? "text-[#34C759]" : (isWhatsAppConnected ? "text-[#34C759]" : "text-[#FF3B30]"),
            suffix: pendingSuggestions > 0 ? "pendentes" : undefined,
          },
        ]
      : []),
  ]

  return (
    <div className="flex gap-3 px-5 md:px-8 py-3 overflow-x-auto bg-white border-b border-border"
      style={{ zIndex: "var(--z-header)" }}
    >
      {kpis.map((kpi) => {
        const Icon = kpi.icon
        return (
          <div
            key={kpi.label}
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-muted min-w-[155px]"
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            <div className={`h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 ${kpi.iconBg}`}>
              <Icon className={`h-4 w-4 ${kpi.iconColor}`} />
            </div>
            <div className="min-w-0">
              <p className={`text-lg font-bold leading-tight ${kpi.valueColor ?? "text-foreground"}`}>
                {kpi.value}
                {kpi.suffix && (
                  <span className="text-xs font-normal text-muted-foreground ml-1">{kpi.suffix}</span>
                )}
              </p>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">{kpi.label}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
