import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { ConfiguracoesClient } from "./client"

export default async function ConfiguracoesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("name, organization_id")
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
    <ConfiguracoesClient
      userName={profile?.name ?? ""}
      userEmail={user.email ?? ""}
      orgName={orgName}
    />
  )
}
