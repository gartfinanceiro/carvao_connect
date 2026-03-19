import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { stripe } from "@/lib/stripe"

export async function POST() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 })
    }

    // Get org's stripe customer ID
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: "Perfil não encontrado." }, { status: 404 })
    }

    const { data: org } = await supabase
      .from("organizations")
      .select("stripe_customer_id")
      .eq("id", profile.organization_id)
      .single()

    if (!org?.stripe_customer_id) {
      return NextResponse.json(
        { error: "Nenhuma assinatura encontrada." },
        { status: 404 }
      )
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: org.stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_SITE_URL}/configuracoes`,
    })

    return NextResponse.json({ url: portalSession.url })
  } catch (err) {
    console.error("[portal] Error:", err)
    return NextResponse.json(
      { error: "Erro ao acessar portal de cobrança." },
      { status: 500 }
    )
  }
}
