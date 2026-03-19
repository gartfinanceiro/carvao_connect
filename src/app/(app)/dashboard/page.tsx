import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { FeedWrapper } from "./feed-wrapper"

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", user.id)
    .single()

  const userName = profile?.name ?? user.email ?? "Usuário"

  return <FeedWrapper userName={userName} />
}
