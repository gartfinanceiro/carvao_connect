"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import { Search, Phone, PhoneIncoming, MessageCircle, UserCheck, ChevronDown, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { formatRelativeDate } from "@/lib/utils"
import { contactTypeLabels, contactResultLabels, contactResultColors } from "@/lib/labels"
import type { ContactType, ContactResult } from "@/types/database"

interface ActivityItem {
  id: string
  supplier_id: string
  contact_type: ContactType
  result: ContactResult
  notes: string | null
  load_promised: boolean
  promised_volume: number | null
  promised_date: string | null
  created_at: string
  suppliers: {
    name: string
  } | null
  profiles: {
    name: string
  } | null
}

const contactIcons: Record<ContactType, typeof Phone> = {
  ligou: Phone,
  recebeu_ligacao: PhoneIncoming,
  whatsapp: MessageCircle,
  presencial: UserCheck,
}

const PAGE_SIZE = 15

export function ActivityFeed({ refreshKey }: { refreshKey?: number }) {
  const [items, setItems] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(0)

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

    // Simple query — only join suppliers (which has a FK)
    let query = supabase
      .from("interactions")
      .select("id, supplier_id, contact_type, result, notes, load_promised, promised_volume, promised_date, created_at, suppliers(name), profiles:user_id(name)")
      .order("created_at", { ascending: false })
      .range(from, to)

    if (searchTerm.trim()) {
      query = query.ilike("notes", `%${searchTerm}%`)
    }

    const { data, error } = await query

    if (error) {
      console.error("ActivityFeed error:", error.message)
      if (!append) setItems([])
      setHasMore(false)
    } else if (data) {
      const typed = data as unknown as ActivityItem[]
      if (append) {
        setItems(prev => [...prev, ...typed])
      } else {
        setItems(typed)
      }
      setHasMore(typed.length >= PAGE_SIZE)
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
          <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div>
      <div className="relative mb-4">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#999]" />
        <Input
          placeholder="Buscar nas interações..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 rounded-xl h-10 border-[#E5E5E5] bg-white text-[14px]"
        />
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-[#E5E5E5] bg-white p-8 text-center" style={{ boxShadow: "var(--shadow-card)" }}>
          <p className="text-[14px] text-[#999]">
            {search ? "Nenhuma interação encontrada." : "Nenhuma interação registrada ainda."}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-[#E5E5E5] bg-white overflow-hidden max-h-[600px] overflow-y-auto" style={{ boxShadow: "var(--shadow-card)" }}>
          {items.map((item, i) => {
            const Icon = contactIcons[item.contact_type]
            const resultClass = contactResultColors[item.result]
            const supplierName = item.suppliers?.name ?? "Fornecedor"
            const userName = item.profiles?.name
            return (
              <div
                key={item.id}
                className={`px-5 py-4 ${i < items.length - 1 ? "border-b border-[#E5E5E5]/60" : ""} hover:bg-[#FAFAFA] transition-colors`}
              >
                <div className="flex items-start gap-3.5">
                  <div className="mt-0.5 h-9 w-9 rounded-full bg-[#F2F2F2] flex items-center justify-center flex-shrink-0">
                    <Icon className="h-4 w-4 text-[#737373]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/fornecedores/${item.supplier_id}`}
                        className="text-[14px] font-bold text-[#111] hover:underline"
                      >
                        {supplierName}
                      </Link>
                      <span className="text-[12px] text-[#D5D5D5]">·</span>
                      <span className="text-[13px] text-[#737373]">
                        {contactTypeLabels[item.contact_type]}
                      </span>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${resultClass}`}>
                        {contactResultLabels[item.result]}
                      </span>
                    </div>

                    {item.notes && (
                      <p className="text-[14px] text-[#374151] mt-1.5 leading-relaxed">
                        {item.notes}
                      </p>
                    )}

                    {item.load_promised && item.promised_volume && (
                      <div className="mt-2 inline-flex items-center gap-1.5 bg-[#E8F5E9] text-[#1B4332] text-[12px] font-semibold px-2.5 py-1 rounded-lg">
                        📦 {item.promised_volume} carga{item.promised_volume > 1 ? "s" : ""} prometida{item.promised_volume > 1 ? "s" : ""}
                        {item.promised_date && (
                          <span className="text-[#40916C]">
                            · {new Date(item.promised_date + "T12:00:00").toLocaleDateString("pt-BR")}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-3 mt-2.5">
                      {userName && (
                        <>
                          <span className="text-[12px] font-medium text-[#737373]">
                            {userName}
                          </span>
                          <span className="text-[12px] text-[#D5D5D5]">·</span>
                        </>
                      )}
                      <span className="text-[12px] text-[#999]">
                        {formatRelativeDate(item.created_at)}
                      </span>
                      <Link
                        href={`/fornecedores/${item.supplier_id}`}
                        className="text-[12px] font-semibold text-[#1B4332] hover:underline ml-auto"
                      >
                        Ver perfil →
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {hasMore && items.length > 0 && (
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
