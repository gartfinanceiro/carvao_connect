"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { SupplierDetail } from "@/components/supplier-detail"
import { useSubscription } from "@/components/subscription-provider"
import type { Supplier } from "@/types/database"

export default function SupplierDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { isAdmin } = useSubscription()
  const id = params.id as string

  const [supplier, setSupplier] = useState<Supplier | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [totalContractedAll, setTotalContractedAll] = useState(0)

  const fetchSupplier = useCallback(async () => {
    const supabase = createClient()
    const [supplierResult, contractedResult] = await Promise.all([
      supabase
        .from("suppliers")
        .select("*")
        .eq("id", id)
        .single(),
      supabase
        .from("suppliers")
        .select("contracted_loads")
        .neq("status", "arquivado"),
    ])

    if (supplierResult.error || !supplierResult.data) {
      setNotFound(true)
      setLoading(false)
      return
    }

    setSupplier(supplierResult.data as Supplier)
    const total = (contractedResult.data ?? []).reduce(
      (sum: number, s: { contracted_loads: number }) => sum + (s.contracted_loads ?? 0),
      0,
    )
    setTotalContractedAll(total)
    setLoading(false)
  }, [id])

  useEffect(() => {
    fetchSupplier()
  }, [fetchSupplier])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (notFound || !supplier) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-muted-foreground">Fornecedor não encontrado.</p>
        <Button variant="outline" onClick={() => router.push("/fornecedores")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para fornecedores
        </Button>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6">
      <Button
        variant="ghost"
        size="sm"
        className="mb-4"
        onClick={() => router.push("/fornecedores")}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Fornecedores
      </Button>

      <SupplierDetail
        supplier={supplier}
        totalContractedAll={totalContractedAll}
        onRefresh={fetchSupplier}
        onArchive={isAdmin ? async (s) => {
          const supabase = createClient()
          const previousStatus = s.status
          const { error } = await supabase
            .from("suppliers")
            .update({ status: "arquivado" })
            .eq("id", s.id)
          if (error) {
            toast.error("Erro ao arquivar fornecedor.")
            return
          }
          await supabase
            .from("alerts")
            .update({ status: "descartado", dismissed_reason: "Fornecedor arquivado" })
            .eq("supplier_id", s.id)
            .eq("status", "pendente")
          toast.success(`${s.name} arquivado`, {
            action: {
              label: "Desfazer",
              onClick: async () => {
                await supabase.from("suppliers").update({ status: previousStatus }).eq("id", s.id)
                fetchSupplier()
              },
            },
          })
          fetchSupplier()
        } : undefined}
        onReactivate={isAdmin ? async (s) => {
          const supabase = createClient()
          const { data } = await supabase.rpc("check_plan_limit", { p_resource: "suppliers" })
          const limit = data as unknown as { allowed: boolean; max: number } | null
          if (limit && !limit.allowed) {
            toast.error(`Limite de ${limit.max} fornecedores atingido. Faça upgrade para reativar.`, {
              action: { label: "Ver planos", onClick: () => router.push("/planos") },
            })
            return
          }
          const { error } = await supabase
            .from("suppliers")
            .update({ status: "ativo" })
            .eq("id", s.id)
          if (error) {
            toast.error("Erro ao reativar fornecedor.")
            return
          }
          toast.success(`${s.name} reativado`)
          fetchSupplier()
        } : undefined}
      />
    </div>
  )
}
