import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { EmpresaSection } from "@/components/settings/empresa-section"

export default async function EmpresaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single()

  let orgName = ""
  if (profile?.organization_id) {
    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", profile.organization_id)
      .single()
    orgName = org?.name ?? ""
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl">
      <EmpresaSection orgName={orgName} />
    </div>
  )
}
