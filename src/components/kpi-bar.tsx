import { createClient } from "@/lib/supabase/server"
import { Badge } from "@/components/ui/badge"
import { Users, Bell, Truck } from "lucide-react"

export async function KpiBar() {
  const supabase = await createClient()

  const now = new Date()
  const endOfToday = new Date(now)
  endOfToday.setHours(23, 59, 59, 999)
  const todayStr = now.toISOString().split("T")[0]
  const in7days = new Date(now)
  in7days.setDate(in7days.getDate() + 7)
  const in7daysStr = in7days.toISOString().split("T")[0]

  const [suppliersResult, alertsResult, loadsResult] = await Promise.all([
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
  ])

  const activeSuppliers = suppliersResult.count ?? 0
  const pendingAlerts = alertsResult.count ?? 0
  const totalLoads = loadsResult.data?.reduce(
    (sum, i) => sum + (i.promised_volume ?? 0),
    0
  ) ?? 0

  return (
    <div className="flex items-center gap-6 px-6 py-3 border-b bg-white overflow-x-auto">
      <div className="flex items-center gap-2 text-sm whitespace-nowrap">
        <Users className="h-4 w-4 text-[#1B4332]" />
        <span className="text-muted-foreground">Fornecedores ativos:</span>
        <span className="font-semibold">{activeSuppliers}</span>
      </div>

      <div className="flex items-center gap-2 text-sm whitespace-nowrap">
        <Bell className="h-4 w-4 text-[#1B4332]" />
        <span className="text-muted-foreground">Alertas pendentes:</span>
        {pendingAlerts > 0 ? (
          <Badge variant="destructive" className="text-xs">
            {pendingAlerts}
          </Badge>
        ) : (
          <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-xs">
            0
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-2 text-sm whitespace-nowrap">
        <Truck className="h-4 w-4 text-[#1B4332]" />
        <span className="text-muted-foreground">Cargas previstas (7d):</span>
        <span className="font-semibold">{totalLoads}</span>
      </div>
    </div>
  )
}
