"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { Badge } from "@/components/ui/badge"
import { MessageSquare, Loader2 } from "lucide-react"
import {
  contactTypeLabels,
  contactTypeIcons,
  contactResultLabels,
  contactResultColors,
  nextStepTypeLabels,
} from "@/lib/labels"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import type { Interaction } from "@/types/database"

interface InteractionWithUser extends Interaction {
  profiles: { name: string } | null
}

interface InteractionTimelineProps {
  supplierId: string
  refreshKey: number
}

export function InteractionTimeline({
  supplierId,
  refreshKey,
}: InteractionTimelineProps) {
  const [interactions, setInteractions] = useState<InteractionWithUser[]>([])
  const [loading, setLoading] = useState(true)

  const fetchInteractions = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    const { data } = await supabase
      .from("interactions")
      .select(`
        *,
        profiles:user_id (name)
      `)
      .eq("supplier_id", supplierId)
      .order("created_at", { ascending: false })

    setInteractions((data as InteractionWithUser[]) ?? [])
    setLoading(false)
  }, [supplierId])

  useEffect(() => {
    fetchInteractions()
  }, [fetchInteractions, refreshKey])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (interactions.length === 0) {
    return (
      <div className="text-center py-8">
        <MessageSquare className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">
          Nenhuma interação registrada ainda.
          <br />
          Use o botão &quot;Nova interação&quot; para começar.
        </p>
      </div>
    )
  }

  return (
    <div className="relative">
      {interactions.map((interaction, index) => {
        const isLast = index === interactions.length - 1
        const icon = contactTypeIcons[interaction.contact_type]
        const typeLabel = contactTypeLabels[interaction.contact_type]
        const resultLabel = contactResultLabels[interaction.result]
        const resultColor = contactResultColors[interaction.result]
        const userName = interaction.profiles?.name ?? "Usuário"
        const createdAt = new Date(interaction.created_at)
        const dateStr = format(createdAt, "dd/MM/yyyy HH:mm", { locale: ptBR })

        return (
          <div key={interaction.id} className="relative flex gap-4">
            {/* Timeline line */}
            <div className="flex flex-col items-center">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white border-2 border-gray-200 text-base z-10">
                {icon}
              </div>
              {!isLast && (
                <div className="w-0.5 flex-1 bg-gray-200" />
              )}
            </div>

            {/* Content */}
            <div className={`flex-1 pb-6 ${isLast ? "" : ""}`}>
              {/* Header */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {dateStr}
                </span>
                <span className="text-sm text-muted-foreground">—</span>
                <span className="text-sm font-medium">{userName}</span>
              </div>

              {/* Type + Result */}
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm font-medium">
                  {typeLabel}
                </span>
                <span className="text-muted-foreground">→</span>
                <Badge className={`${resultColor} hover:${resultColor.split(" ")[0]}`}>
                  {resultLabel}
                </Badge>
              </div>

              {/* Notes */}
              {interaction.notes && (
                <div className="mt-2 rounded-md bg-gray-50 border border-gray-100 px-3 py-2">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {interaction.notes}
                  </p>
                </div>
              )}

              {/* Load promised */}
              {interaction.load_promised && (
                <div className="mt-2 flex items-center gap-1.5 text-sm">
                  <span>📦</span>
                  <span className="font-medium">
                    Carga prometida: {interaction.promised_volume} carga
                    {(interaction.promised_volume ?? 0) > 1 ? "s" : ""} em{" "}
                    {interaction.promised_date
                      ? format(new Date(interaction.promised_date + "T12:00:00"), "dd/MM/yyyy")
                      : "—"}
                  </span>
                </div>
              )}

              {/* Next step */}
              {interaction.next_step === "retornar_em" &&
                interaction.next_step_date && (
                  <div className="mt-2 flex items-center gap-1.5 text-sm text-[#1B4332]">
                    <span>🔔</span>
                    <span className="font-medium">
                      Retornar em{" "}
                      {format(
                        new Date(interaction.next_step_date),
                        "dd/MM/yyyy 'às' HH:mm",
                        { locale: ptBR }
                      )}
                    </span>
                  </div>
                )}

              {interaction.next_step === "aguardar_retorno" && (
                <div className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <span>⏳</span>
                  <span>{nextStepTypeLabels.aguardar_retorno}</span>
                </div>
              )}

              {/* Auto return alert info */}
              {interaction.result === "nao_atendeu" &&
                interaction.next_step === "nenhum" && (
                  <div className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <span>⏰</span>
                    <span>Retorno automático criado (2h)</span>
                  </div>
                )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
