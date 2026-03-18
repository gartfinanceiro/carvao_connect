"use client"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MessageSquare, Clock, ChevronDown, CheckCircle2 } from "lucide-react"
import { alertTypeIcons } from "@/lib/labels"
import { cn } from "@/lib/utils"
import Link from "next/link"
import type { Alert, AlertType, CharcoalType } from "@/types/database"

export interface AlertWithSupplier extends Alert {
  supplier: {
    id: string
    name: string
    charcoal_type: CharcoalType
    phones: string[]
  } | null
}

interface AlertCardProps {
  alert: AlertWithSupplier
  section: "overdue" | "today" | "upcoming" | "done"
  onContact: (alert: AlertWithSupplier) => void
  onSnooze: (alertId: string) => void
  onDismiss: (alertId: string, reason: string) => void
}

function getRelativeTime(dateString: string, section: string): string {
  const date = new Date(dateString)
  const now = new Date()

  if (section === "done") {
    return `concluído ${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
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

const borderColors = {
  overdue: "border-l-red-500",
  today: "border-l-amber-500",
  upcoming: "border-l-gray-300",
  done: "border-l-green-500",
}

export function AlertCard({
  alert,
  section,
  onContact,
  onSnooze,
  onDismiss,
}: AlertCardProps) {
  const icon = alertTypeIcons[alert.type as AlertType]
  const isDone = section === "done"
  const timeLabel = getRelativeTime(
    isDone ? alert.updated_at : alert.due_at,
    section
  )

  return (
    <div
      className={cn(
        "rounded-lg border border-l-4 bg-white p-4 transition-all hover:shadow-sm",
        borderColors[section],
        isDone && "opacity-60"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <span className="text-lg mt-0.5 shrink-0">
            {isDone ? "" : icon}
            {isDone && <CheckCircle2 className="h-5 w-5 text-green-600" />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold truncate">
                {alert.supplier ? (
                  <Link
                    href={`/fornecedores/${alert.supplier.id}`}
                    className="hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {alert.title}
                  </Link>
                ) : (
                  alert.title
                )}
              </h3>
            </div>
            {alert.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {alert.description}
              </p>
            )}
          </div>
        </div>
        <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
          {timeLabel}
        </span>
      </div>

      {!isDone && (
        <div className="flex items-center gap-2 mt-3 ml-8">
          <Button
            size="sm"
            className="bg-[#1B4332] hover:bg-[#2D6A4F] h-7 text-xs"
            onClick={() => onContact(alert)}
          >
            <MessageSquare className="mr-1 h-3 w-3" />
            Registrar contato
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => onSnooze(alert.id)}
          >
            <Clock className="mr-1 h-3 w-3" />
            Adiar 1 dia
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="sm" className="h-7 text-xs" />
              }
            >
              Descartar
              <ChevronDown className="ml-1 h-3 w-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => onDismiss(alert.id, "Resolvido")}>
                Resolvido
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDismiss(alert.id, "Não relevante")}>
                Não relevante
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDismiss(alert.id, "Duplicado")}>
                Duplicado
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  )
}
