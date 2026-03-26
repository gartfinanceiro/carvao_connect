import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { IntegracoesSection } from "@/components/settings/integracoes-section"

export default async function IntegracoesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  return (
    <div className="p-4 md:p-6 max-w-3xl">
      <IntegracoesSection />
    </div>
  )
}
