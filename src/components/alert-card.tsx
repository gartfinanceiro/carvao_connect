"use client"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ChevronDown, CalendarCheck, Truck, MoreHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import type { Alert } from "@/types/database"

export interface AlertWithSupplier extends Alert {
  supplier: {
    id: string
    name: string
    phones: string[]
  } | null
}

interface AlertCardProps {
  alert: AlertWithSupplier
  section: "overdue" | "today" | "upcoming" | "done"
  onContact: (alert: AlertWithSupplier) => void
  onSnooze: (alertId: string) => void
  onDismiss: (alertId: string, reason: string) => void
  onRegisterDischarge?: (supplierId: string, interactionId?: string) => void
  onScheduleQueue?: (alert: AlertWithSupplier) => void
  onCancelLoad?: (alert: AlertWithSupplier) => void
  onPostponeLoad?: (alert: AlertWithSupplier) => void
  isLast?: boolean
}

function getRelativeTime(dateString: string, section: string): string {
  const date = new Date(dateString)
  const now = new Date()

  if (section === "done") {
    return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  }

  const diffMs = date.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < -1) return `há ${Math.abs(diffDays)} dias`
  if (diffDays === -1) return "ontem"
  if (diffDays === 0) {
    return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  }
  if (diffDays === 1) return "amanhã"
  return `em ${diffDays} dias`
}

export function AlertCard({
  alert,
  section,
  onContact,
  onSnooze,
  onDismiss,
  onRegisterDischarge,
  onScheduleQueue,
  onCancelLoad,
  onPostponeLoad,
  isLast = false,
}: AlertCardProps) {
  const isDone = section === "done"
  const isLoadAlert = alert.type === "confirmacao_carga"
  const timeLabel = getRelativeTime(
    isDone ? alert.updated_at : alert.due_at,
    section
  )

  return (
    <div className={cn(
      "py-4 px-5",
      !isLast && "border-b border-border/60",
      isDone && "opacity-40"
    )}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-foreground leading-snug">
            {alert.supplier ? (
              <Link href={`/fornecedores/${alert.supplier.id}`} className="hover:underline">
                {alert.title}
              </Link>
            ) : alert.title}
          </p>
          {alert.description && (
            <p className="text-[13px] text-muted-foreground mt-0.5 leading-relaxed line-clamp-1">
              {alert.description}
            </p>
          )}
        </div>
        <span className="text-[12px] font-medium text-muted-foreground whitespace-nowrap shrink-0">
          {timeLabel}
        </span>
      </div>

      {!isDone && (
        <div className="flex items-center gap-2 mt-3">
          {isLoadAlert && alert.supplier && onScheduleQueue ? (
            <>
              {/* Primary: Schedule in queue */}
              <Button
                size="sm"
                className="bg-[#1B4332] hover:bg-[#2D6A4F] text-white h-8 text-[13px] font-semibold px-4 rounded-lg active:scale-[0.97] transition-all gap-1.5"
                onClick={() => onScheduleQueue(alert)}
              >
                <CalendarCheck className="h-3.5 w-3.5" />
                Agendar carga
              </Button>
              {/* Secondary: Direct discharge */}
              {onRegisterDischarge && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-[13px] font-semibold px-4 rounded-lg border-[#1B4332]/20 text-[#1B4332] hover:bg-[#E8F5E9] active:scale-[0.97] transition-all gap-1.5"
                  onClick={() => onRegisterDischarge(alert.supplier!.id, alert.interaction_id ?? undefined)}
                >
                  <Truck className="h-3.5 w-3.5" />
                  Registrar descarga
                </Button>
              )}
              {/* More dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground" />
                  }
                >
                  <MoreHorizontal className="h-4 w-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {onPostponeLoad && (
                    <DropdownMenuItem onClick={() => onPostponeLoad(alert)}>Adiar carga</DropdownMenuItem>
                  )}
                  {onCancelLoad && (
                    <DropdownMenuItem onClick={() => onCancelLoad(alert)}>Carga cancelada</DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => onContact(alert)}>Registrar contato</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onSnooze(alert.id)}>Adiar alerta</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Button
                size="sm"
                className="bg-[#1B4332] hover:bg-[#2D6A4F] text-white h-8 text-[13px] font-semibold px-4 rounded-lg active:scale-[0.97] transition-all"
                onClick={() => onContact(alert)}
              >
                Registrar contato
              </Button>
              <button
                className="text-[13px] font-medium text-muted-foreground hover:text-foreground ml-1 transition-colors"
                onClick={() => onSnooze(alert.id)}
              >
                Adiar
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="ghost" size="sm" className="h-8 text-[13px] font-medium px-2 text-muted-foreground hover:text-foreground" />
                  }
                >
                  Descartar <ChevronDown className="ml-0.5 h-3 w-3" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => onDismiss(alert.id, "Resolvido")}>Resolvido</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onDismiss(alert.id, "Não relevante")}>Não relevante</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onDismiss(alert.id, "Duplicado")}>Duplicado</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      )}
    </div>
  )
}
