import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { DiscountPolicySettings } from "@/components/discount-policy-settings"

export default async function PrecosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  return (
    <div className="p-4 md:p-6">
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Tabela de Preços</h2>
          <p className="text-sm text-muted-foreground mt-1">Faixas de preço por densidade, descontos e regras comerciais</p>
        </div>
        <DiscountPolicySettings />
      </div>
    </div>
  )
}
