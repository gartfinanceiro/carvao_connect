import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { EquipeSection } from "@/components/settings/equipe-section"

export default async function EquipePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  return (
    <div className="p-4 md:p-6 max-w-3xl">
      <EquipeSection />
    </div>
  )
}
