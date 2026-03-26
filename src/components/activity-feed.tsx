"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import {
  Search, Phone, Truck, CalendarCheck, XCircle, CalendarClock, UserPlus, ChevronDown, Loader2,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { formatRelativeDate } from "@/lib/utils"
import type { ActivityEventType } from "@/lib/activity-logger"

interface ActivityItem {
  id: string
  event_type: ActivityEventType
  supplier_id: string | null
  title: string
  subtitle: string | null
  user_name: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

const EVENT_CONFIG: Record<ActivityEventType, { icon: typeof Phone; color: string; bg: string; label: string }> = {
  interaction_registered: { icon: Phone, color: "text-[#1B4332]", bg: "bg-[#E8F5E9]", label: "Interação" },
  discharge_registered: { icon: Truck, color: "text-emerald-700", bg: "bg-emerald-50", label: "Descarga" },
  load_scheduled: { icon: CalendarCheck, color: "text-blue-700", bg: "bg-blue-50", label: "Agendamento" },
  load_cancelled: { icon: XCircle, color: "text-red-600", bg: "bg-red-50", label: "Cancelamento" },
  load_postponed: { icon: CalendarClock, color: "text-amber-700", bg: "bg-amber-50", label: "Adiamento" },
  supplier_created: { icon: UserPlus, color: "text-[#1B4332]", bg: "bg-[#E8F5E9]", label: "Novo fornecedor" },
}

const PAGE_SIZE = 20

export function ActivityFeed({ refreshKey }: { refreshKey?: number }) {
  const [items, setItems] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(0)

  // Fallback: if activity_log is empty, show interactions
  const [useFallback, setUseFallback] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  const fetchItems = useCallback(async (pageNum: number, searchTerm: string, append: boolean) => {
    if (pageNum === 0) setLoading(true)
    else setLoadingMore(true)

    const supabase = createClient()
    const from = pageNum * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    // Try activity_log first
    let query = supabase
      .from("activity_log")
      .select("id, event_type, supplier_id, title, subtitle, user_name, metadata, created_at")
      .order("created_at", { ascending: false })
      .range(from, to)

    if (searchTerm.trim()) {
      query = query.or(`title.ilike.%${searchTerm}%,subtitle.ilike.%${searchTerm}%`)
    }

    const { data, error } = await query

    if (error) {
      console.error("ActivityFeed error:", error.message)
      if (!append) setItems([])
      setHasMore(false)
    } else if (data && data.length > 0) {
      const typed = data as ActivityItem[]
      if (append) {
        setItems(prev => [...prev, ...typed])
      } else {
        setItems(typed)
      }
      setHasMore(typed.length >= PAGE_SIZE)
      setUseFallback(false)
    } else if (pageNum === 0 && !searchTerm.trim()) {
      // Empty activity_log — show fallback from interactions
      setUseFallback(true)
      const { data: interactions } = await supabase
        .from("interactions")
        .select("id, supplier_id, contact_type, result, notes, created_at, suppliers(name), profiles:user_id(name)")
        .order("created_at", { ascending: false })
        .range(0, 14)

      if (interactions) {
        const mapped: ActivityItem[] = interactions.map((i: Record<string, unknown>) => {
          const sup = i.suppliers as { name: string } | null
          const prof = i.profiles as { name: string } | null
          return {
            id: i.id as string,
            event_type: "interaction_registered" as ActivityEventType,
            supplier_id: i.supplier_id as string,
            title: sup?.name || "Fornecedor",
            subtitle: `${i.contact_type} — ${i.result}`,
            user_name: prof?.name || null,
            metadata: { contact_type: i.contact_type, result: i.result, notes: i.notes },
            created_at: i.created_at as string,
          }
        })
        setItems(mapped)
        setHasMore(false)
      }
    } else {
      if (!append) setItems([])
      setHasMore(false)
    }

    setLoading(false)
    setLoadingMore(false)
  }, [])

  useEffect(() => {
    setPage(0)
    fetchItems(0, debouncedSearch, false)
  }, [debouncedSearch, fetchItems])

  useEffect(() => {
    if (refreshKey !== undefined && refreshKey > 0) {
      setPage(0)
      fetchItems(0, debouncedSearch, false)
    }
  }, [refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleLoadMore() {
    const nextPage = page + 1
    setPage(nextPage)
    fetchItems(nextPage, debouncedSearch, true)
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-10 bg-muted rounded-xl animate-pulse" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div>
      <div className="relative mb-4">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#999]" />
        <Input
          placeholder="Buscar atividades..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 rounded-xl h-10 border-[#E5E5E5] bg-white text-[14px]"
        />
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-[#E5E5E5] bg-white p-8 text-center" style={{ boxShadow: "var(--shadow-card)" }}>
          <p className="text-[14px] text-[#999]">
            {search ? "Nenhuma atividade encontrada." : "Nenhuma atividade registrada ainda."}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-[#E5E5E5] bg-white overflow-hidden max-h-[600px] overflow-y-auto" style={{ boxShadow: "var(--shadow-card)" }}>
          {items.map((item, i) => {
            const config = EVENT_CONFIG[item.event_type] || EVENT_CONFIG.interaction_registered
            const Icon = config.icon
            return (
              <div
                key={item.id}
                className={`px-5 py-4 ${i < items.length - 1 ? "border-b border-[#E5E5E5]/60" : ""} hover:bg-[#FAFAFA] transition-colors`}
              >
                <div className="flex items-start gap-3.5">
                  <div className={`mt-0.5 h-9 w-9 rounded-full ${config.bg} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`h-4 w-4 ${config.color}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {item.supplier_id ? (
                        <Link
                          href={`/fornecedores/${item.supplier_id}`}
                          className="text-[14px] font-bold text-[#111] hover:underline"
                        >
                          {item.title}
                        </Link>
                      ) : (
                        <span className="text-[14px] font-bold text-[#111]">{item.title}</span>
                      )}
                      <Badge className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${config.bg} ${config.color} border-0`}>
                        {config.label}
                      </Badge>
                    </div>

                    {item.subtitle && (
                      <p className="text-[13px] text-[#737373] mt-1 leading-relaxed line-clamp-2">
                        {item.subtitle}
                      </p>
                    )}

                    <div className="flex items-center gap-3 mt-2">
                      {item.user_name && (
                        <>
                          <span className="text-[12px] font-medium text-[#737373]">
                            {item.user_name}
                          </span>
                          <span className="text-[12px] text-[#D5D5D5]">·</span>
                        </>
                      )}
                      <span className="text-[12px] text-[#999]">
                        {formatRelativeDate(item.created_at)}
                      </span>
                      {item.supplier_id && (
                        <Link
                          href={`/fornecedores/${item.supplier_id}`}
                          className="text-[12px] font-semibold text-[#1B4332] hover:underline ml-auto"
                        >
                          Ver perfil →
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {hasMore && items.length > 0 && !useFallback && (
        <div className="flex justify-center mt-4">
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="flex items-center gap-2 text-[13px] font-semibold text-[#737373] hover:text-[#111] transition-colors px-4 py-2 rounded-lg hover:bg-[#F2F2F2]"
          >
            {loadingMore ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
            Carregar mais
          </button>
        </div>
      )}
    </div>
  )
}
