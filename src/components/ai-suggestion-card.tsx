"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { ConversationViewer } from "@/components/conversation-viewer"
import { Check, Pencil, Eye, X, Loader2, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"
import type { AiSuggestion } from "@/types/database"

export interface SuggestionWithSupplier extends AiSuggestion {
  supplier: { id: string; name: string } | null
  conversation: { id: string; phone: string } | null
}

interface AiSuggestionCardProps {
  suggestion: SuggestionWithSupplier
  onConfirm: (suggestion: SuggestionWithSupplier) => void
  onEdit: (suggestion: SuggestionWithSupplier) => void
  onDismiss: (suggestionId: string) => void
}

export function AiSuggestionCard({
  suggestion,
  onConfirm,
  onEdit,
  onDismiss,
}: AiSuggestionCardProps) {
  const [conversationOpen, setConversationOpen] = useState(false)
  const [dismissing, setDismissing] = useState(false)

  const supplierName = suggestion.supplier?.name ?? "Fornecedor desconhecido"
  const timeAgo = formatDistanceToNow(new Date(suggestion.created_at), {
    addSuffix: true,
    locale: ptBR,
  })

  // Build extracted data line
  const parts: string[] = []
  if (suggestion.load_promised && suggestion.promised_volume) {
    parts.push(
      `${suggestion.promised_volume} carga${suggestion.promised_volume > 1 ? "s" : ""}`
    )
  }
  if (suggestion.promised_date) {
    const d = new Date(suggestion.promised_date + "T12:00:00")
    parts.push(
      d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
    )
  }
  if (suggestion.price_per_mdc) {
    parts.push(
      `R$ ${suggestion.price_per_mdc.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}/mdc`
    )
  }
  const extractedLine = parts.length > 0 ? parts.join(" · ") : null

  async function handleDismiss() {
    setDismissing(true)
    const supabase = createClient()
    const { error } = await supabase
      .from("ai_suggestions")
      .update({
        status: "dismissed",
        dismissed_reason: "descartado_pelo_usuario",
      })
      .eq("id", suggestion.id)

    if (error) {
      toast.error("Erro ao descartar sugestão.")
    } else {
      onDismiss(suggestion.id)
    }
    setDismissing(false)
  }

  return (
    <>
      <div className="border-l-2 border-emerald-400 bg-white px-4 py-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">
              WhatsApp
            </span>
            <span className="text-muted-foreground/40">·</span>
            <span className="font-medium text-foreground">
              {supplierName}
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground">{timeAgo}</span>
        </div>

        {/* Summary */}
        {suggestion.summary && (
          <p className="text-sm text-foreground mt-1.5 leading-snug">
            {suggestion.summary}
          </p>
        )}

        {/* Extracted data */}
        {extractedLine && (
          <p className="text-xs text-muted-foreground mt-1">
            {extractedLine}
          </p>
        )}

        {/* Low confidence warning */}
        {suggestion.confidence < 0.7 && (
          <div className="flex items-center gap-1.5 mt-2 text-xs text-amber-600">
            <AlertTriangle className="h-3 w-3" />
            <span>
              Confiança {Math.round(suggestion.confidence * 100)}% — revise antes de confirmar
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 mt-3">
          <Button
            size="sm"
            className="h-7 text-xs bg-[#1B4332] hover:bg-[#2D6A4F] rounded-lg"
            onClick={() => onConfirm(suggestion)}
          >
            <Check className="mr-1 h-3 w-3" />
            Confirmar
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs rounded-lg"
            onClick={() => onEdit(suggestion)}
          >
            <Pencil className="mr-1 h-3 w-3" />
            Editar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground rounded-lg"
            onClick={() => setConversationOpen(true)}
          >
            <Eye className="mr-1 h-3 w-3" />
            Ver conversa
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground rounded-lg ml-auto"
            onClick={handleDismiss}
            disabled={dismissing}
          >
            {dismissing ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <X className="h-3 w-3" />
            )}
          </Button>
        </div>
      </div>

      {/* Conversation viewer */}
      {suggestion.conversation_id && (
        <ConversationViewer
          conversationId={suggestion.conversation_id}
          supplierName={supplierName}
          open={conversationOpen}
          onOpenChange={setConversationOpen}
        />
      )}
    </>
  )
}
