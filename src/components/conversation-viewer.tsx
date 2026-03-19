"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Loader2, Mic, FileText, Image as ImageIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import type { WhatsAppMessage } from "@/types/database"

interface ConversationViewerProps {
  conversationId: string
  supplierName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ConversationViewer({
  conversationId,
  supplierName,
  open,
  onOpenChange,
}: ConversationViewerProps) {
  const [messages, setMessages] = useState<WhatsAppMessage[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!open) return
    async function fetchMessages() {
      setLoading(true)
      const supabase = createClient()
      const { data } = await supabase
        .from("whatsapp_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("message_timestamp", { ascending: true })

      setMessages((data as WhatsAppMessage[]) ?? [])
      setLoading(false)
    }
    fetchMessages()
  }, [open, conversationId])

  const firstMsg = messages[0]
  const dateLabel = firstMsg
    ? new Date(firstMsg.message_timestamp).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : ""

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md w-full overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Conversa com {supplierName}</SheetTitle>
          <SheetDescription>
            {dateLabel} — {messages.length} mensagen{messages.length !== 1 ? "s" : ""}
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex flex-col gap-1 px-4 pb-4">
            {messages.map((msg, i) => {
              const isOutbound = msg.direction === "outbound"
              const prevMsg = i > 0 ? messages[i - 1] : null
              const senderChanged = !prevMsg || prevMsg.direction !== msg.direction
              const time = new Date(msg.message_timestamp).toLocaleTimeString(
                "pt-BR",
                { hour: "2-digit", minute: "2-digit" }
              )

              return (
                <div
                  key={msg.id}
                  className={cn(
                    "flex flex-col",
                    isOutbound ? "items-end" : "items-start",
                    senderChanged && i > 0 ? "mt-3" : ""
                  )}
                >
                  {senderChanged && !isOutbound && (
                    <span className="text-[11px] text-muted-foreground font-medium mb-0.5 ml-1">
                      {msg.sender_name || "Fornecedor"}
                    </span>
                  )}
                  {senderChanged && isOutbound && (
                    <span className="text-[11px] text-muted-foreground font-medium mb-0.5 mr-1">
                      Comprador
                    </span>
                  )}
                  <div
                    className={cn(
                      "max-w-[80%] rounded-lg px-3 py-2",
                      isOutbound
                        ? "bg-emerald-50/60"
                        : "bg-muted/40"
                    )}
                  >
                    <MessageContent msg={msg} />
                    <p
                      className={cn(
                        "text-[10px] text-muted-foreground mt-0.5",
                        isOutbound ? "text-right" : "text-left"
                      )}
                    >
                      {time}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

function MessageContent({ msg }: { msg: WhatsAppMessage }) {
  switch (msg.message_type) {
    case "text":
      return (
        <p className="text-sm text-foreground whitespace-pre-wrap">
          {msg.content}
        </p>
      )
    case "audio":
      return (
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground italic">
          <Mic className="h-3.5 w-3.5" />
          <span>Mensagem de áudio</span>
        </div>
      )
    case "image":
      return (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <ImageIcon className="h-3.5 w-3.5" />
            <span>Foto</span>
          </div>
          {msg.content && (
            <p className="text-sm text-foreground">{msg.content}</p>
          )}
        </div>
      )
    case "document":
      return (
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <FileText className="h-3.5 w-3.5" />
          <span>{msg.file_name || "Documento"}</span>
        </div>
      )
    default:
      return (
        <p className="text-sm text-muted-foreground italic">
          [{msg.message_type}]
        </p>
      )
  }
}
