"use client"

import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Bell, LogOut } from "lucide-react"

interface AppHeaderProps {
  userName: string
  userEmail: string
}

export function AppHeader({ userName, userEmail }: AppHeaderProps) {
  const router = useRouter()
  const [alertCount, setAlertCount] = useState(0)

  useEffect(() => {
    async function fetchAlertCount() {
      const supabase = createClient()
      const { count } = await supabase
        .from("alerts")
        .select("*", { count: "exact", head: true })
        .eq("status", "pendente")
        .lte("due_at", new Date().toISOString())
      setAlertCount(count ?? 0)
    }
    fetchAlertCount()
    const interval = setInterval(fetchAlertCount, 60000)
    return () => clearInterval(interval)
  }, [])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  return (
    <header className="hidden md:flex items-center justify-end gap-4 h-16 px-8 bg-white border-b border-border backdrop-blur-sm sticky top-0"
      style={{ zIndex: "var(--z-header)" }}
    >
      {/* Notification bell */}
      <button
        className="relative p-2 rounded-lg hover:bg-muted transition-colors"
        onClick={() => router.push("/dashboard")}
      >
        <Bell className="h-5 w-5 text-muted-foreground" />
        {alertCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-[#FF3B30] text-white text-[9px] font-bold rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-1">
            {alertCount > 99 ? "99+" : alertCount}
          </span>
        )}
      </button>

      {/* User profile */}
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-muted transition-colors">
          <div className="h-8 w-8 rounded-full bg-[#E8F5E9] flex items-center justify-center">
            <span className="text-xs font-semibold text-[#1B4332]">
              {userName.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="text-left hidden lg:block">
            <p className="text-[13px] font-semibold text-foreground leading-tight">{userName}</p>
            <p className="text-[11px] text-muted-foreground/60 leading-tight">{userEmail}</p>
          </div>
          <span className="text-muted-foreground/60 text-xs ml-1">›</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
