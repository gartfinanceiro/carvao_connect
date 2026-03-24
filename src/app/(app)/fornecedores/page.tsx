"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Search, Lock, Archive, Upload } from "lucide-react"
import { toast } from "sonner"
import { SupplierTable } from "@/components/supplier-table"
import { SupplierFilters } from "@/components/supplier-filters"
import { SupplierForm } from "@/components/supplier-form"
import { SupplierImport } from "@/components/supplier-import"
import { InteractionForm } from "@/components/interaction-form"
import { useSubscription } from "@/components/subscription-provider"
import { AccessGate } from "@/components/access-gate"
import type { Supplier } from "@/types/database"

const PAGE_SIZE = 20

export default function FornecedoresPage() {
  return (
    <AccessGate module="fornecedores">
      <FornecedoresContent />
    </AccessGate>
  )
}

function FornecedoresContent() {
  const router = useRouter()
  const { subscription, isReadOnly, isAdmin } = useSubscription()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [sortColumn, setSortColumn] = useState("name")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")

  // Filters
  const [personType, setPersonType] = useState("all")
  const [docStatus, setDocStatus] = useState("all")
  const [status, setStatus] = useState("all")
  const [uf, setUf] = useState("all")
  const [porte, setPorte] = useState("all")

  // Form dialog
  const [formOpen, setFormOpen] = useState(false)
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null)

  // View mode: active (default, excludes archived) or archived
  const [viewMode, setViewMode] = useState<"active" | "archived">("active")

  // Plan limit info
  const [limitInfo, setLimitInfo] = useState<{ current: number; max: number } | null>(null)

  // Total contracted across all active suppliers (for classification)
  const [totalContractedAll, setTotalContractedAll] = useState(0)

  // Interaction dialog
  const [interactionOpen, setInteractionOpen] = useState(false)
  const [interactionSupplier, setInteractionSupplier] = useState<Supplier | null>(null)

  // Import dialog
  const [importOpen, setImportOpen] = useState(false)

  const fetchSuppliers = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    let query = supabase
      .from("suppliers")
      .select("*", { count: "exact" })

    // Search
    if (search.trim()) {
      query = query.or(
        `name.ilike.%${search}%,city.ilike.%${search}%,document.ilike.%${search}%`
      )
    }

    // View mode: archived vs active
    if (viewMode === "archived") {
      query = query.eq("status", "arquivado")
    } else {
      query = query.neq("status", "arquivado")
    }

    // Filters
    if (personType !== "all") query = query.eq("person_type", personType)
    if (docStatus !== "all") query = query.eq("doc_status", docStatus)
    if (status !== "all") query = query.eq("status", status)
    if (uf !== "all") query = query.eq("state", uf)

    // Sort
    const ascending = sortDirection === "asc"
    query = query.order(sortColumn, { ascending, nullsFirst: false })

    // Pagination
    const from = (page - 1) * PAGE_SIZE
    const to = from + PAGE_SIZE - 1
    query = query.range(from, to)

    const { data, count, error } = await query

    if (!error) {
      setSuppliers((data as Supplier[]) ?? [])
      setTotalCount(count ?? 0)
    }
    setLoading(false)
  }, [search, personType, docStatus, status, uf, sortColumn, sortDirection, page, viewMode])

  useEffect(() => {
    fetchSuppliers()
  }, [fetchSuppliers])

  // Fetch plan limit info + total contracted loads for classification
  useEffect(() => {
    async function fetchMeta() {
      const supabase = createClient()
      const [limitResult, contractedResult] = await Promise.all([
        supabase.rpc("check_plan_limit", { p_resource: "suppliers" }),
        supabase
          .from("suppliers")
          .select("contracted_loads")
          .neq("status", "arquivado"),
      ])
      const info = limitResult.data as unknown as { current: number; max: number } | null
      if (info) setLimitInfo(info)
      const total = (contractedResult.data ?? []).reduce(
        (sum: number, s: { contracted_loads: number }) => sum + (s.contracted_loads ?? 0),
        0,
      )
      setTotalContractedAll(total)
    }
    fetchMeta()
  }, [suppliers])

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1)
  }, [search, personType, docStatus, status, uf, porte, viewMode])

  function handleSort(column: string) {
    if (sortColumn === column) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortColumn(column)
      setSortDirection("asc")
    }
  }

  async function handleNewSupplier() {
    if (isReadOnly) {
      toast.error("Seu plano não permite criar fornecedores. Assine para continuar.")
      return
    }

    // Check supplier limit
    const supabase = createClient()
    const { data } = await supabase.rpc("check_plan_limit", { p_resource: "suppliers" })
    const limit = data as unknown as { allowed: boolean; current: number; limit: number } | null

    if (limit && !limit.allowed) {
      toast.error(
        `Limite de ${limit.limit} fornecedores atingido. Faça upgrade para aumentar o limite.`,
        {
          action: {
            label: "Ver planos",
            onClick: () => router.push("/planos"),
          },
        }
      )
      return
    }

    setEditSupplier(null)
    setFormOpen(true)
  }

  function handleNewInteraction(supplier: Supplier) {
    setInteractionSupplier(supplier)
    setInteractionOpen(true)
  }

  function handleEditSupplier(supplier: Supplier) {
    setEditSupplier(supplier)
    setFormOpen(true)
  }

  async function handleArchive(supplier: Supplier) {
    const previousStatus = supplier.status
    const supabase = createClient()

    const { error } = await supabase
      .from("suppliers")
      .update({ status: "arquivado" })
      .eq("id", supplier.id)

    if (error) {
      toast.error("Erro ao arquivar fornecedor.")
      return
    }

    // Dismiss pending alerts for this supplier
    await supabase
      .from("alerts")
      .update({ status: "descartado", dismissed_reason: "Fornecedor arquivado" })
      .eq("supplier_id", supplier.id)
      .eq("status", "pendente")

    toast.success(`${supplier.name} arquivado`, {
      action: {
        label: "Desfazer",
        onClick: async () => {
          await supabase
            .from("suppliers")
            .update({ status: previousStatus })
            .eq("id", supplier.id)
          fetchSuppliers()
        },
      },
    })
    fetchSuppliers()
  }

  async function handleReactivate(supplier: Supplier) {
    // Check plan limit before reactivating
    const supabase = createClient()
    const { data } = await supabase.rpc("check_plan_limit", { p_resource: "suppliers" })
    const limit = data as unknown as { allowed: boolean; current: number; max: number } | null

    if (limit && !limit.allowed) {
      toast.error(
        `Limite de ${limit.max} fornecedores atingido. Faça upgrade para reativar.`,
        {
          action: {
            label: "Ver planos",
            onClick: () => router.push("/planos"),
          },
        }
      )
      return
    }

    const { error } = await supabase
      .from("suppliers")
      .update({ status: "ativo" })
      .eq("id", supplier.id)

    if (error) {
      toast.error("Erro ao reativar fornecedor.")
      return
    }

    toast.success(`${supplier.name} reativado`)
    fetchSuppliers()
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fornecedores</h1>
          <div className="flex items-center gap-2 mt-1">
            {limitInfo && (
              <span className={`text-xs font-medium rounded-full px-2.5 py-0.5 inline-block ${
                limitInfo.current >= limitInfo.max
                  ? "bg-red-50 text-red-600"
                  : limitInfo.current >= limitInfo.max * 0.8
                    ? "bg-amber-50 text-amber-600"
                    : "bg-muted text-muted-foreground"
              }`}>
                {limitInfo.current}/{limitInfo.max} fornecedores
              </span>
            )}
            {!limitInfo && (
              <span className="bg-muted text-muted-foreground text-xs font-medium rounded-full px-2.5 py-0.5 inline-block">{totalCount} cadastrados</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-border/50 bg-white overflow-hidden">
            <button
              onClick={() => setViewMode("active")}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === "active"
                  ? "bg-[#1B4332] text-white"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Ativos
            </button>
            <button
              onClick={() => setViewMode("archived")}
              className={`px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1 ${
                viewMode === "archived"
                  ? "bg-[#1B4332] text-white"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Archive className="h-3 w-3" />
              Arquivados
            </button>
          </div>
          {viewMode === "active" && (
            <>
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => {
                  if (isReadOnly) {
                    toast.error("Seu plano não permite importar fornecedores. Assine para continuar.")
                    return
                  }
                  setImportOpen(true)
                }}
              >
                <Upload className="mr-2 h-4 w-4" />
                Importar
              </Button>
              <Button
                className={`rounded-xl ${isReadOnly ? "bg-gray-400 hover:bg-gray-500" : "bg-[#1B4332] hover:bg-[#2D6A4F]"}`}
                onClick={handleNewSupplier}
              >
                {isReadOnly ? <Lock className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
                Novo fornecedor
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-lg">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, cidade ou CPF/CNPJ..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 rounded-xl"
        />
      </div>

      {/* Filters */}
      <SupplierFilters
        personType={personType}
        docStatus={docStatus}
        status={status}
        uf={uf}
        porte={porte}
        onPersonTypeChange={setPersonType}
        onDocStatusChange={setDocStatus}
        onStatusChange={setStatus}
        onUfChange={setUf}
        onPorteChange={setPorte}
      />

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      ) : (
        <SupplierTable
          suppliers={suppliers}
          totalCount={totalCount}
          page={page}
          pageSize={PAGE_SIZE}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          porteFilter={porte}
          totalContractedAll={totalContractedAll}
          onSort={handleSort}
          onPageChange={setPage}
          onNewInteraction={handleNewInteraction}
          onEditSupplier={handleEditSupplier}
          onArchive={isAdmin ? handleArchive : undefined}
          onReactivate={isAdmin ? handleReactivate : undefined}
        />
      )}

      {/* Form Dialog */}
      <SupplierForm
        open={formOpen}
        onOpenChange={setFormOpen}
        supplier={editSupplier}
        onSuccess={fetchSuppliers}
      />

      {/* Interaction Dialog (quick from list) */}
      {interactionSupplier && (
        <InteractionForm
          supplierId={interactionSupplier.id}
          supplierName={interactionSupplier.name}
          organizationId={interactionSupplier.organization_id}
          open={interactionOpen}
          onOpenChange={setInteractionOpen}
          onSuccess={fetchSuppliers}
        />
      )}

      {/* Import Dialog */}
      <SupplierImport
        open={importOpen}
        onOpenChange={setImportOpen}
        onSuccess={() => {
          fetchSuppliers()
          // Refresh limit info
          const supabase = createClient()
          supabase.rpc("check_plan_limit", { p_resource: "suppliers" }).then(({ data }) => {
            const info = data as unknown as { current: number; max: number } | null
            if (info) setLimitInfo(info)
          })
        }}
        currentCount={limitInfo?.current ?? 0}
        maxCount={limitInfo?.max ?? 50}
      />
    </div>
  )
}
