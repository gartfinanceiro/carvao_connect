"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { useSubscription } from "@/components/subscription-provider"
import type { ModuleKey } from "@/lib/permissions"
import { LayoutDashboard, Users, Truck, ClipboardList, Settings } from "lucide-react"

const NAV_ITEMS: { href: string; label: string; icon: typeof LayoutDashboard; module: ModuleKey }[] = [
  { href: "/dashboard", label: "Início", icon: LayoutDashboard, module: "feed" },
  { href: "/fornecedores", label: "Fornecedores", icon: Users, module: "fornecedores" },
  { href: "/descargas", label: "Descargas", icon: Truck, module: "descargas" },
  { href: "/fila", label: "Fila", icon: ClipboardList, module: "fila" },
  { href: "/configuracoes", label: "Config", icon: Settings, module: "configuracoes" },
]

export function MobileNav() {
  const pathname = usePathname()
  const [alertCount, setAlertCount] = useState(0)
  const [queueCount, setQueueCount] = useState(0)
  const { hasAccess } = useSubscription()

  const visibleItems = useMemo(
    () => NAV_ITEMS.filter((item) => hasAccess(item.module)),
    [hasAccess]
  )

  useEffect(() => {
    async function fetchCounts() {
      const supabase = createClient()

      // Fetch alert count
      const { count: alertCountResult } = await supabase
        .from("alerts")
        .select("*", { count: "exact", head: true })
        .eq("status", "pendente")
        .lte("due_at", new Date().toISOString())
      setAlertCount(alertCountResult ?? 0)

      // Fetch queue count for today
      const today = new Date().toISOString().slice(0, 10)
      const { count: queueCountResult } = await supabase
        .from("queue_entries")
        .select("*", { count: "exact", head: true })
        .eq("scheduled_date", today)
        .eq("status", "aguardando")
      setQueueCount(queueCountResult ?? 0)
    }
    fetchCounts()
  }, [])

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-border/50">
      <div className="flex items-center justify-around h-14">
        {visibleItems.map((item) => {
          const Icon = item.icon
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href)
          const showBadge = (item.href === "/fila" && queueCount > 0) || (item.href === "/dashboard" && alertCount > 0)
          const badgeCount = item.href === "/fila" ? queueCount : alertCount

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 w-16 h-full relative transition-colors duration-200",
                isActive
                  ? "text-[#1B4332]"
                  : "text-muted-foreground"
              )}
            >
              <Icon className={cn("h-5 w-5", isActive && "stroke-[2.5px]")} />
              <span className="text-[10px] font-medium">{item.label}</span>
              {showBadge && (
                <span className="absolute top-1.5 right-2 bg-[#FF3B30] text-white text-[8px] font-bold rounded-full min-w-[14px] h-[14px] flex items-center justify-center px-0.5">
                  {badgeCount > 99 ? "99+" : badgeCount}
                </span>
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
