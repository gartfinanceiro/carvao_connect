"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"
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
}

export function QuickInteraction({ open, onOpenChange, onSuccess }: QuickInteractionProps) {
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([])
  const [search, setSearch] = useState("")
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierOption | null>(null)
  const [interactionOpen, setInteractionOpen] = useState(false)

  useEffect(() => {
    if (!open) {
      setSearch("")
      return
    }
    async function fetch() {
      const supabase = createClient()
      const { data } = await supabase
        .from("suppliers")
        .select("id, name, organization_id, city, state")
        .eq("status", "ativo")
        .order("name")
      setSuppliers(data ?? [])
    }
    fetch()
  }, [open])

  const filtered = suppliers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.city?.toLowerCase().includes(search.toLowerCase()))
  )

  function handleSelect(supplier: SupplierOption) {
    setSelectedSupplier(supplier)
    onOpenChange(false)
    setInteractionOpen(true)
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
            <DialogTitle className="text-[18px] font-bold">Selecione o fornecedor</DialogTitle>
          </DialogHeader>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#999]" />
            <Input
              placeholder="Buscar fornecedor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 rounded-xl h-10 text-[14px]"
              autoFocus
            />
          </div>
          <div className="overflow-y-auto max-h-[400px] -mx-1">
            {filtered.length === 0 ? (
              <p className="text-center text-[14px] text-[#999] py-8">Nenhum fornecedor encontrado.</p>
            ) : (
              filtered.map((s) => (
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
