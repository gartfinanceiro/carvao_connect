"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Search } from "lucide-react"
import { SupplierTable } from "@/components/supplier-table"
import { SupplierFilters } from "@/components/supplier-filters"
import { SupplierForm } from "@/components/supplier-form"
import { InteractionForm } from "@/components/interaction-form"
import type { Supplier } from "@/types/database"

const PAGE_SIZE = 20

export default function FornecedoresPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [sortColumn, setSortColumn] = useState("name")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")

  // Filters
  const [charcoalType, setCharcoalType] = useState("all")
  const [docStatus, setDocStatus] = useState("all")
  const [status, setStatus] = useState("all")
  const [uf, setUf] = useState("all")

  // Form dialog
  const [formOpen, setFormOpen] = useState(false)
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null)

  // Interaction dialog
  const [interactionOpen, setInteractionOpen] = useState(false)
  const [interactionSupplier, setInteractionSupplier] = useState<Supplier | null>(null)

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

    // Filters
    if (charcoalType !== "all") query = query.eq("charcoal_type", charcoalType)
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
  }, [search, charcoalType, docStatus, status, uf, sortColumn, sortDirection, page])

  useEffect(() => {
    fetchSuppliers()
  }, [fetchSuppliers])

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1)
  }, [search, charcoalType, docStatus, status, uf])

  function handleSort(column: string) {
    if (sortColumn === column) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortColumn(column)
      setSortDirection("asc")
    }
  }

  function handleNewSupplier() {
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

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fornecedores</h1>
          <p className="text-sm text-muted-foreground">
            <span className="bg-muted text-muted-foreground text-xs font-medium rounded-full px-2.5 py-0.5 inline-block">{totalCount} cadastrados</span>
          </p>
        </div>
        <Button
          className="bg-[#1B4332] hover:bg-[#2D6A4F] rounded-xl"
          onClick={handleNewSupplier}
        >
          <Plus className="mr-2 h-4 w-4" />
          Novo fornecedor
        </Button>
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
        charcoalType={charcoalType}
        docStatus={docStatus}
        status={status}
        uf={uf}
        onCharcoalTypeChange={setCharcoalType}
        onDocStatusChange={setDocStatus}
        onStatusChange={setStatus}
        onUfChange={setUf}
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
          onSort={handleSort}
          onPageChange={setPage}
          onNewInteraction={handleNewInteraction}
          onEditSupplier={handleEditSupplier}
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
    </div>
  )
}
