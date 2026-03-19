import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Sidebar } from "@/components/sidebar"
import { MobileNav } from "@/components/mobile-nav"
import { AppHeader } from "@/components/app-header"
import { SubscriptionProvider, type SubscriptionInfo } from "@/components/subscription-provider"
import { TrialBanner } from "@/components/trial-banner"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
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

  // Fetch subscription info server-side for initial render
  const { data: subData } = await supabase.rpc("get_my_subscription")
  const subscriptionInfo = subData as unknown as SubscriptionInfo | null

  const userName = profile?.name ?? user.email ?? "Usuário"
  const userEmail = user.email ?? ""

  return (
    <SubscriptionProvider initialData={subscriptionInfo}>
      <div className="flex h-screen bg-[#F5F5F7]">
        <Sidebar userName={userName} />
        <div className="flex-1 flex flex-col min-w-0">
          <AppHeader userName={userName} userEmail={userEmail} />
          <TrialBanner />
          <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
            {children}
          </main>
        </div>
        <MobileNav />
      </div>
    </SubscriptionProvider>
  )
}
