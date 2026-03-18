"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import {
  Package,
  Scale,
  FileCheck,
  DollarSign,
  Phone,
  MapPin,
  FileText,
  Copy,
  Check,
  Pencil,
  Plus,
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
import type { Supplier } from "@/types/database"

interface SupplierDetailProps {
  supplier: Supplier
  onRefresh: () => void
}

function DocStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "regular":
      return (
        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
          Regular
        </Badge>
      )
    case "pendente":
      return (
        <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
          Pendente
        </Badge>
      )
    case "irregular":
      return (
        <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
          Irregular
        </Badge>
      )
    default:
      return null
  }
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "ativo":
      return <Badge variant="outline" className="border-green-600 text-green-700">Ativo</Badge>
    case "inativo":
      return <Badge variant="outline" className="border-gray-400 text-gray-500">Inativo</Badge>
    case "bloqueado":
      return <Badge variant="outline" className="border-red-600 text-red-700">Bloqueado</Badge>
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
          <h1 className="text-2xl font-bold">{supplier.name}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <Badge className="bg-[#D8F3DC] text-[#1B4332] hover:bg-[#D8F3DC]">
              {charcoalTypeLabels[supplier.charcoal_type]}
            </Badge>
            <DocStatusBadge status={supplier.doc_status} />
            <StatusBadge status={supplier.status} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            Editar
          </Button>
          <Button
            className="bg-[#1B4332] hover:bg-[#2D6A4F]"
            onClick={() => setInteractionOpen(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Nova interação
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Package className="h-4 w-4" />
              Capacidade
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {supplier.contracted_loads} de{" "}
              {supplier.monthly_capacity ?? 0}
            </p>
            <p className="text-xs text-muted-foreground">cargas/mês</p>
            <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-[#1B4332] rounded-full transition-all"
                style={{ width: `${Math.min(capacityPercentage, 100)}%` }}
              />
            </div>
            {idle > 0 && (
              <p className="mt-1 text-xs text-[#1B4332] font-medium">
                {idle} ociosa{idle > 1 ? "s" : ""}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Scale className="h-4 w-4" />
              Densidade
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {supplier.avg_density ? `${supplier.avg_density}` : "—"}
            </p>
            <p className="text-xs text-muted-foreground">
              kg/mdc • {charcoalTypeLabels[supplier.charcoal_type]}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileCheck className="h-4 w-4" />
              Documentação
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DocStatusBadge status={supplier.doc_status} />
            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
              <p>DAP: {formatDate(supplier.dap_expiry)}</p>
              <p>GF: {formatDate(supplier.gf_expiry)}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Último preço
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatCurrency(supplier.last_price)}
            </p>
            <p className="text-xs text-muted-foreground">/mdc</p>
          </CardContent>
        </Card>
      </div>

      {/* Contact info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informações de contato</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-2">
            <Phone className="h-4 w-4 mt-0.5 text-muted-foreground" />
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

          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">
              {supplier.city && supplier.state
                ? `${supplier.city}/${supplier.state}`
                : "Não informado"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">
              {formatDocument(supplier.document)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Timeline de interações</CardTitle>
        </CardHeader>
        <CardContent>
          <InteractionTimeline
            supplierId={supplier.id}
            refreshKey={timelineRefreshKey}
          />
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Observações</CardTitle>
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
    </div>
  )
}
