"use client"

import { useState, useEffect, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Search, ChevronRight, ChevronLeft, Users, Building2 } from "lucide-react"
import { InteractionForm } from "@/components/interaction-form"

interface QuickInteractionProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

interface SupplierOption {
  id: string
  name: string
  organization_id: string
  city: string | null
  state: string | null
  contact_name: string | null
}

type ViewMode = "fornecedor" | "negociador"

export function QuickInteraction({ open, onOpenChange, onSuccess }: QuickInteractionProps) {
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([])
  const [search, setSearch] = useState("")
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierOption | null>(null)
  const [interactionOpen, setInteractionOpen] = useState(false)
  const [mode, setMode] = useState<ViewMode>("fornecedor")
  // Quando negociador é selecionado e tem múltiplos fornecedores
  const [expandedNegociador, setExpandedNegociador] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setSearch("")
      setExpandedNegociador(null)
      return
    }
    async function fetch() {
      const supabase = createClient()
      const { data } = await supabase
        .from("suppliers")
        .select("id, name, organization_id, city, state, contact_name")
        .eq("status", "ativo")
        .order("name")
      setSuppliers(data ?? [])
    }
    fetch()
  }, [open])

  // Agrupar fornecedores por negociador
  const negociadorGroups = useMemo(() => {
    const groups = new Map<string, SupplierOption[]>()
    for (const s of suppliers) {
      const key = s.contact_name?.trim() || ""
      if (!key) continue
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(s)
    }
    // Ordenar por nome do negociador
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0], "pt-BR"))
  }, [suppliers])

  // Fornecedores sem negociador
  const semNegociador = useMemo(
    () => suppliers.filter((s) => !s.contact_name?.trim()),
    [suppliers]
  )

  // Filtro por busca
  const filteredSuppliers = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.city?.toLowerCase().includes(search.toLowerCase())
  )

  const filteredNegociadores = negociadorGroups.filter(
    ([name, sups]) =>
      name.toLowerCase().includes(search.toLowerCase()) ||
      sups.some(
        (s) =>
          s.name.toLowerCase().includes(search.toLowerCase()) ||
          s.city?.toLowerCase().includes(search.toLowerCase())
      )
  )

  const filteredSemNegociador = semNegociador.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.city?.toLowerCase().includes(search.toLowerCase())
  )

  function handleSelect(supplier: SupplierOption) {
    setSelectedSupplier(supplier)
    onOpenChange(false)
    setExpandedNegociador(null)
    setInteractionOpen(true)
  }

  function handleNegociadorClick(name: string, sups: SupplierOption[]) {
    if (sups.length === 1) {
      // Só tem um fornecedor — vai direto
      handleSelect(sups[0])
    } else {
      // Múltiplos — expande para mostrar os fornecedores
      setExpandedNegociador(expandedNegociador === name ? null : name)
    }
  }

  function handleInteractionClose(isOpen: boolean) {
    setInteractionOpen(isOpen)
    if (!isOpen) {
      setSelectedSupplier(null)
    }
  }

  function handleInteractionSuccess() {
    setSelectedSupplier(null)
    setInteractionOpen(false)
    onSuccess()
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="text-[18px] font-bold">
              {mode === "fornecedor" ? "Selecione o fornecedor" : "Selecione o negociador"}
            </DialogTitle>
          </DialogHeader>

          {/* Toggle Fornecedor / Negociador */}
          <div className="flex rounded-lg border border-border overflow-hidden mb-3">
            <button
              onClick={() => { setMode("fornecedor"); setExpandedNegociador(null); setSearch("") }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[13px] font-medium transition-colors ${
                mode === "fornecedor"
                  ? "bg-[#1B4332] text-white"
                  : "bg-white text-muted-foreground hover:bg-muted/50"
              }`}
            >
              <Building2 className="h-3.5 w-3.5" />
              Fornecedor
            </button>
            <button
              onClick={() => { setMode("negociador"); setExpandedNegociador(null); setSearch("") }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[13px] font-medium transition-colors ${
                mode === "negociador"
                  ? "bg-[#1B4332] text-white"
                  : "bg-white text-muted-foreground hover:bg-muted/50"
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              Negociador
            </button>
          </div>

          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#999]" />
            <Input
              placeholder={mode === "fornecedor" ? "Buscar fornecedor..." : "Buscar negociador..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 rounded-xl h-10 text-[14px]"
              autoFocus
            />
          </div>

          <div className="overflow-y-auto max-h-[400px] -mx-1">
            {mode === "fornecedor" ? (
              // ── Modo Fornecedor (original) ──
              filteredSuppliers.length === 0 ? (
                <p className="text-center text-[14px] text-[#999] py-8">Nenhum fornecedor encontrado.</p>
              ) : (
                filteredSuppliers.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleSelect(s)}
                    className="w-full text-left px-4 py-3 rounded-lg hover:bg-[#F2F2F2] transition-colors flex items-center justify-between"
                  >
                    <div>
                      <p className="text-[14px] font-semibold text-[#111]">{s.name}</p>
                      {s.city && s.state && (
                        <p className="text-[12px] text-[#999]">{s.city}/{s.state}</p>
                      )}
                    </div>
                    <span className="text-[12px] text-[#999]">→</span>
                  </button>
                ))
              )
            ) : (
              // ── Modo Negociador ──
              <>
                {filteredNegociadores.length === 0 && filteredSemNegociador.length === 0 ? (
                  <p className="text-center text-[14px] text-[#999] py-8">Nenhum negociador encontrado.</p>
                ) : (
                  <>
                    {filteredNegociadores.map(([name, sups]) => {
                      const isExpanded = expandedNegociador === name
                      return (
                        <div key={name}>
                          <button
                            onClick={() => handleNegociadorClick(name, sups)}
                            className="w-full text-left px-4 py-3 rounded-lg hover:bg-[#F2F2F2] transition-colors flex items-center justify-between"
                          >
                            <div>
                              <p className="text-[14px] font-semibold text-[#111]">{name}</p>
                              <p className="text-[12px] text-[#999]">
                                {sups.length === 1
                                  ? sups[0].name
                                  : `${sups.length} fornecedores`}
                              </p>
                            </div>
                            {sups.length > 1 ? (
                              <ChevronRight className={`h-4 w-4 text-[#999] transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                            ) : (
                              <span className="text-[12px] text-[#999]">→</span>
                            )}
                          </button>
                          {/* Sub-lista de fornecedores do negociador */}
                          {isExpanded && sups.length > 1 && (
                            <div className="ml-4 border-l-2 border-border/60 pl-3 mb-1">
                              {sups.map((s) => (
                                <button
                                  key={s.id}
                                  onClick={() => handleSelect(s)}
                                  className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-[#F2F2F2] transition-colors flex items-center justify-between"
                                >
                                  <div>
                                    <p className="text-[13px] font-medium text-[#111]">{s.name}</p>
                                    {s.city && s.state && (
                                      <p className="text-[11px] text-[#999]">{s.city}/{s.state}</p>
                                    )}
                                  </div>
                                  <span className="text-[12px] text-[#999]">→</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}

                    {/* Fornecedores sem negociador */}
                    {filteredSemNegociador.length > 0 && (
                      <>
                        {filteredNegociadores.length > 0 && (
                          <div className="px-4 pt-3 pb-1">
                            <p className="text-[11px] text-[#999] font-medium uppercase tracking-wider">Sem negociador</p>
                          </div>
                        )}
                        {filteredSemNegociador.map((s) => (
                          <button
                            key={s.id}
                            onClick={() => handleSelect(s)}
                            className="w-full text-left px-4 py-3 rounded-lg hover:bg-[#F2F2F2] transition-colors flex items-center justify-between"
                          >
                            <div>
                              <p className="text-[14px] font-semibold text-[#111]">{s.name}</p>
                              {s.city && s.state && (
                                <p className="text-[12px] text-[#999]">{s.city}/{s.state}</p>
                              )}
                            </div>
                            <span className="text-[12px] text-[#999]">→</span>
                          </button>
                        ))}
                      </>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {selectedSupplier && (
        <InteractionForm
          supplierId={selectedSupplier.id}
          supplierName={selectedSupplier.name}
          organizationId={selectedSupplier.organization_id}
          open={interactionOpen}
          onOpenChange={handleInteractionClose}
          onSuccess={handleInteractionSuccess}
        />
      )}
    </>
  )
}
