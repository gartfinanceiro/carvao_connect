"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Users,
  Truck,
  ClipboardList,
  Settings,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react"

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/fornecedores", label: "Fornecedores", icon: Users },
  { href: "/descargas", label: "Descargas", icon: Truck },
  { href: "/fila", label: "Fila", icon: ClipboardList },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
]

interface SidebarProps {
  userName: string
}

export function Sidebar({ userName }: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [alertCount, setAlertCount] = useState(0)
  const [queueCount, setQueueCount] = useState(0)

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
      try {
        const today = new Date().toISOString().slice(0, 10)
        const { count: queueCountResult, error: queueError } = await supabase
          .from("queue_entries")
          .select("*", { count: "exact", head: true })
          .eq("scheduled_date", today)
          .eq("status", "aguardando")
        if (!queueError) setQueueCount(queueCountResult ?? 0)
      } catch {}
    }
    fetchCounts()
    const interval = setInterval(fetchCounts, 60000)
    return () => clearInterval(interval)
  }, [])

  return (
    <aside
      className={cn(
        "group hidden md:flex flex-col bg-white border-r border-border transition-all duration-300 ease-in-out",
        collapsed ? "w-[68px]" : "w-64"
      )}
    >
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-border">
        <Image src="/icon-original.png" alt="Carvão Connect" width={28} height={28} className="flex-shrink-0" />
        {!collapsed && (
          <Link href="/" className="text-[15px] font-bold tracking-tight text-foreground">
            Carvão Connect
          </Link>
        )}
      </div>

      <nav className="flex-1 px-3 pt-5">
        <div className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const isActive = item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href)
            const showBadge = (item.href === "/fila" && queueCount > 0) || (item.href === "/dashboard" && alertCount > 0)
            const badgeCount = item.href === "/fila" ? queueCount : alertCount

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] font-medium transition-all duration-150 relative",
                  isActive
                    ? "bg-[#E8F5E9] text-[#1B4332] font-semibold"
                    : "text-[#737373] hover:bg-muted hover:text-foreground"
                )}
                title={collapsed ? item.label : undefined}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[#1B4332] rounded-r-full" />
                )}
                <Icon className={cn("h-[18px] w-[18px] flex-shrink-0", isActive ? "text-[#1B4332]" : "text-[#999]")} />
                {!collapsed && <span>{item.label}</span>}
                {showBadge && (
                  <span className={cn(
                    "bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1",
                    collapsed ? "absolute -top-1 -right-1" : "ml-auto"
                  )}>
                    {badgeCount > 99 ? "99+" : badgeCount}
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      </nav>

      <div className="border-t border-border p-3">
        <button
          className="flex items-center gap-2 rounded-lg px-3 py-2 w-full text-[13px] font-medium text-[#999] hover:bg-muted hover:text-[#737373] transition-all duration-150"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? (
            <PanelLeft className="h-4 w-4 mx-auto" />
          ) : (
            <>
              <PanelLeftClose className="h-4 w-4" />
              <span>Recolher</span>
            </>
          )}
        </button>
      </div>
    </aside>
  )
}
