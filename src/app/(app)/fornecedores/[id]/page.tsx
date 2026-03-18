"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Loader2 } from "lucide-react"
import { SupplierDetail } from "@/components/supplier-detail"
import type { Supplier } from "@/types/database"

export default function SupplierDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [supplier, setSupplier] = useState<Supplier | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const fetchSupplier = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("suppliers")
      .select("*")
      .eq("id", id)
      .single()

    if (error || !data) {
      setNotFound(true)
      setLoading(false)
      return
    }

    setSupplier(data as Supplier)
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

      <SupplierDetail supplier={supplier} onRefresh={fetchSupplier} />
    </div>
  )
}
