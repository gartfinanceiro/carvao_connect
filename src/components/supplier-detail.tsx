"use client"

import { useCallback, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import {
  Copy,
  Check,
  Pencil,
  Plus,
  Truck,
  Package,
  Scale,
  FileCheck,
  DollarSign,
  MessageSquare,
  Eye,
  Loader2,
} from "lucide-react"
import { toast } from "sonner"
import { charcoalTypeLabels } from "@/lib/labels"
import {
  formatCurrency,
  formatPhone,
  formatDocument,
  formatDate,
} from "@/lib/utils"
import { SupplierForm } from "@/components/supplier-form"
import { InteractionForm } from "@/components/interaction-form"
import { InteractionTimeline } from "@/components/interaction-timeline"
import { SupplierDocuments } from "@/components/supplier-documents"
import { DischargeForm } from "@/components/discharge-form"
import { DischargeList } from "@/components/discharge-list"
import { ConversationViewer } from "@/components/conversation-viewer"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import type { Supplier, WhatsAppConversation } from "@/types/database"

interface SupplierDetailProps {
  supplier: Supplier
  onRefresh: () => void
}

function DocStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "regular":
      return <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/50 text-[11px] font-medium rounded-full px-2.5 py-0.5 inline-block">Regular</span>
    case "pendente":
      return <span className="bg-amber-50 text-amber-700 border border-amber-200/50 text-[11px] font-medium rounded-full px-2.5 py-0.5 inline-block">Pendente</span>
    case "irregular":
      return <span className="bg-red-50 text-[#FF3B30] border border-[#FF3B30]/15 text-[11px] font-medium rounded-full px-2.5 py-0.5 inline-block">Irregular</span>
    default:
      return null
  }
}

function DocStatusText({ status }: { status: string }) {
  switch (status) {
    case "regular":
      return <span className="text-xs text-emerald-600 font-medium">Regular</span>
    case "pendente":
      return <span className="text-xs text-amber-600 font-medium">Pendente</span>
    case "irregular":
      return <span className="text-xs text-red-500 font-medium">Irregular</span>
    default:
      return null
  }
}

function StatusText({ status }: { status: string }) {
  switch (status) {
    case "ativo":
      return <span className="text-xs text-emerald-600 font-medium">Ativo</span>
    case "inativo":
      return <span className="text-xs text-muted-foreground font-medium">Inativo</span>
    case "bloqueado":
      return <span className="text-xs text-red-500 font-medium">Bloqueado</span>
    default:
      return null
  }
}

export function SupplierDetail({ supplier, onRefresh }: SupplierDetailProps) {
  const [editOpen, setEditOpen] = useState(false)
  const [interactionOpen, setInteractionOpen] = useState(false)
  const [editingNotes, setEditingNotes] = useState(false)
  const [notes, setNotes] = useState(supplier.notes ?? "")
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null)
  const [timelineRefreshKey, setTimelineRefreshKey] = useState(0)
  const [dischargeOpen, setDischargeOpen] = useState(false)
  const [dischargeRefreshKey, setDischargeRefreshKey] = useState(0)
  const [docCount, setDocCount] = useState<number | null>(null)
  const [uniqueDocTypes, setUniqueDocTypes] = useState<number>(0)
  const [conversations, setConversations] = useState<WhatsAppConversation[]>([])
  const [conversationsLoading, setConversationsLoading] = useState(true)
  const [viewingConversationId, setViewingConversationId] = useState<string | null>(null)

  const fetchConversations = useCallback(async () => {
    setConversationsLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from("whatsapp_conversations")
      .select("*")
      .eq("supplier_id", supplier.id)
      .order("last_message_at", { ascending: false })
      .limit(20)

    setConversations((data as WhatsAppConversation[]) ?? [])
    setConversationsLoading(false)
  }, [supplier.id])

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  const fetchDocCount = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("supplier_documents")
      .select("document_type")
      .eq("supplier_id", supplier.id)

    if (!error && data) {
      setDocCount(data.length)
      const types = new Set(data.map((d) => d.document_type))
      setUniqueDocTypes(types.size)
    }
  }, [supplier.id])

  useEffect(() => {
    fetchDocCount()
  }, [fetchDocCount])

  const idle = (supplier.monthly_capacity ?? 0) - supplier.contracted_loads
  const capacityPercentage =
    supplier.monthly_capacity && supplier.monthly_capacity > 0
      ? (supplier.contracted_loads / supplier.monthly_capacity) * 100
      : 0

  async function handleCopyPhone(phone: string) {
    await navigator.clipboard.writeText(phone)
    setCopiedPhone(phone)
    setTimeout(() => setCopiedPhone(null), 2000)
  }

  async function handleSaveNotes() {
    const supabase = createClient()
    const { error } = await supabase
      .from("suppliers")
      .update({ notes: notes.trim() || null })
      .eq("id", supplier.id)

    if (error) {
      toast.error("Erro ao salvar observações.")
      return
    }
    toast.success("Observações salvas!")
    setEditingNotes(false)
    onRefresh()
  }

  function handleInteractionSuccess() {
    setTimelineRefreshKey((k) => k + 1)
    onRefresh()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{supplier.name}</h1>
          <div className="flex flex-wrap items-center gap-3 mt-1">
            <span className="text-sm text-muted-foreground">{charcoalTypeLabels[supplier.charcoal_type]}</span>
            <span className="text-muted-foreground/30">·</span>
            <DocStatusBadge status={supplier.doc_status} />
            <span className="text-muted-foreground/30">·</span>
            <StatusText status={supplier.status} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="rounded-xl" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            Editar
          </Button>
          <Button variant="outline" className="rounded-xl" onClick={() => setDischargeOpen(true)}>
            <Truck className="mr-2 h-4 w-4" />
            Registrar descarga
          </Button>
          <Button
            className="rounded-xl bg-[#1B4332] hover:bg-[#2D6A4F]"
            onClick={() => setInteractionOpen(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Nova interação
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-2xl border border-border/50 bg-white">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Capacidade</CardTitle>
            <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center">
              <Package className="h-4 w-4 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {supplier.contracted_loads}/{supplier.monthly_capacity ?? 0}
            </p>
            <p className="text-xs text-muted-foreground mt-1">cargas/mês</p>
            <div className="mt-3 h-2.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-[#1B4332] rounded-full transition-all"
                style={{ width: `${Math.min(capacityPercentage, 100)}%` }}
              />
            </div>
            {idle > 0 && (
              <p className="mt-2 text-xs text-emerald-600 font-medium">
                {idle} ociosa{idle > 1 ? "s" : ""}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-border/50 bg-white">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Densidade</CardTitle>
            <div className="h-8 w-8 rounded-full bg-[#E1EDFF] flex items-center justify-center">
              <Scale className="h-4 w-4 text-[#1B4332]" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {supplier.avg_density ? `${supplier.avg_density}` : "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              kg/mdc · {charcoalTypeLabels[supplier.charcoal_type]}
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-border/50 bg-white">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Documentação</CardTitle>
            <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center">
              <FileCheck className="h-4 w-4 text-purple-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="mt-1">
              <DocStatusText status={supplier.doc_status} />
            </div>
            <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
              <p>DCF: {formatDate(supplier.dcf_expiry)}</p>
              {supplier.dcf_issue_date && (
                <p>Emissão: {formatDate(supplier.dcf_issue_date)}</p>
              )}
              {docCount !== null && (
                <p>
                  {uniqueDocTypes >= 11 ? (
                    <span className="text-emerald-600 font-medium">Completo</span>
                  ) : (
                    <span>{uniqueDocTypes} de 11 tipos</span>
                  )}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-border/50 bg-white">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Último preço</CardTitle>
            <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center">
              <DollarSign className="h-4 w-4 text-amber-600" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {formatCurrency(supplier.last_price)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">/mdc</p>
          </CardContent>
        </Card>
      </div>
      <div className="border-b border-black/[0.04]" />

      {/* Contact info */}
      <Card className="rounded-2xl border border-border/50 bg-white">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Informações de contato</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Telefones</p>
            <div className="space-y-1">
              {supplier.phones.map((phone) => (
                <div key={phone} className="flex items-center gap-2">
                  <span className="text-sm">{formatPhone(phone)}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => handleCopyPhone(phone)}
                  >
                    {copiedPhone === phone ? (
                      <Check className="h-3 w-3 text-green-600" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              ))}
              {supplier.phones.length === 0 && (
                <span className="text-sm text-muted-foreground">
                  Nenhum telefone cadastrado
                </span>
              )}
            </div>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-1">Localização</p>
            <span className="text-sm">
              {supplier.city && supplier.state
                ? `${supplier.city}/${supplier.state}`
                : "Não informado"}
            </span>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-1">CPF/CNPJ</p>
            <span className="text-sm">
              {formatDocument(supplier.document)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Documentação completa */}
      <SupplierDocuments
        supplierId={supplier.id}
        organizationId={supplier.organization_id}
      />

      {/* Timeline */}
      <Card className="rounded-2xl border border-border/50 bg-white">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Timeline de interações</CardTitle>
        </CardHeader>
        <CardContent>
          <InteractionTimeline
            supplierId={supplier.id}
            refreshKey={timelineRefreshKey}
          />
        </CardContent>
      </Card>

      {/* WhatsApp Conversations */}
      {conversations.length > 0 && (
        <Card className="rounded-2xl border border-border/50 bg-white">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Conversas WhatsApp
            </CardTitle>
          </CardHeader>
          <CardContent>
            {conversationsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-2">
                {conversations.map((conv) => {
                  const lastMsg = new Date(conv.last_message_at)
                  const dateStr = format(lastMsg, "dd/MM/yyyy HH:mm", { locale: ptBR })
                  const statusLabel =
                    conv.status === "processed" ? "Processada" :
                    conv.status === "processing" ? "Processando..." :
                    conv.status === "open" ? "Aberta" :
                    conv.status === "ready_for_processing" ? "Aguardando IA" :
                    conv.status === "error" ? "Erro" :
                    conv.status === "skipped" ? "Ignorada" : conv.status
                  const statusColor =
                    conv.status === "processed" ? "text-emerald-600" :
                    conv.status === "error" ? "text-red-500" :
                    "text-muted-foreground"

                  return (
                    <div
                      key={conv.id}
                      className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium">{conv.phone}</span>
                          <span className="text-muted-foreground/40">·</span>
                          <span className="text-xs text-muted-foreground">{dateStr}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground">
                            {conv.message_count} mensagen{conv.message_count !== 1 ? "s" : ""}
                          </span>
                          <span className="text-muted-foreground/40">·</span>
                          <span className={`text-xs font-medium ${statusColor}`}>
                            {statusLabel}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-muted-foreground"
                        onClick={() => setViewingConversationId(conv.id)}
                      >
                        <Eye className="mr-1 h-3 w-3" />
                        Ver
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Conversation viewer sheet */}
      {viewingConversationId && (
        <ConversationViewer
          conversationId={viewingConversationId}
          supplierName={supplier.name}
          open={!!viewingConversationId}
          onOpenChange={(open) => {
            if (!open) setViewingConversationId(null)
          }}
        />
      )}

      {/* Descargas */}
      <Card className="rounded-2xl border border-border/50 bg-white">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Histórico de descargas</CardTitle>
            <Button
              size="sm"
              className="bg-[#1B4332] hover:bg-[#2D6A4F]"
              onClick={() => setDischargeOpen(true)}
            >
              <Plus className="mr-1 h-3 w-3" />
              Nova descarga
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <DischargeList
            supplierId={supplier.id}
            refreshKey={dischargeRefreshKey}
          />
        </CardContent>
      </Card>

      {/* Notes */}
      <Card className="rounded-2xl border border-border/50 bg-white">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Observações</CardTitle>
            {!editingNotes && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditingNotes(true)}
              >
                <Pencil className="mr-1 h-3 w-3" />
                Editar
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {editingNotes ? (
            <div className="space-y-2">
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setNotes(supplier.notes ?? "")
                    setEditingNotes(false)
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  className="bg-[#1B4332] hover:bg-[#2D6A4F]"
                  onClick={handleSaveNotes}
                >
                  Salvar
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {supplier.notes || "Nenhuma observação registrada."}
            </p>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Edit dialog */}
      <SupplierForm
        open={editOpen}
        onOpenChange={setEditOpen}
        supplier={supplier}
        onSuccess={onRefresh}
      />

      {/* Interaction dialog */}
      <InteractionForm
        supplierId={supplier.id}
        supplierName={supplier.name}
        organizationId={supplier.organization_id}
        open={interactionOpen}
        onOpenChange={setInteractionOpen}
        onSuccess={handleInteractionSuccess}
      />

      {/* Discharge dialog */}
      <DischargeForm
        open={dischargeOpen}
        onOpenChange={setDischargeOpen}
        supplierId={supplier.id}
        onSuccess={() => {
          setDischargeRefreshKey((k) => k + 1)
          onRefresh()
        }}
      />
    </div>
  )
}
