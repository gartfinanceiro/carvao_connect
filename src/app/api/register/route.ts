import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { stripe, PLANS, type PlanKey } from "@/lib/stripe"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, email, password, companyName, plan } = body as {
      name: string
      email: string
      password: string
      companyName: string
      plan: PlanKey
    }

    // Validate required fields
    if (!name || !email || !password || !companyName || !plan) {
      return NextResponse.json(
        { error: "Todos os campos são obrigatórios." },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "A senha deve ter pelo menos 6 caracteres." },
        { status: 400 }
      )
    }

    const planConfig = PLANS[plan]
    if (!planConfig) {
      return NextResponse.json(
        { error: "Plano inválido." },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    // 1. Check if email already exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers()
    const emailExists = existingUsers?.users?.some(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    )
    if (emailExists) {
      return NextResponse.json(
        { error: "Este email já está cadastrado." },
        { status: 409 }
      )
    }

    // 2. Create Stripe customer
    const stripeCustomer = await stripe.customers.create({
      email,
      name: companyName,
      metadata: { company_name: companyName, user_name: name },
    })

    // 3. Create organization
    const trialEndsAt = new Date()
    trialEndsAt.setDate(trialEndsAt.getDate() + planConfig.trialDays)

    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .insert({
        name: companyName,
        plan: "trial",
        plan_limits: planConfig.limits,
        trial_ends_at: trialEndsAt.toISOString(),
        subscription_status: "trialing",
        stripe_customer_id: stripeCustomer.id,
      })
      .select("id")
      .single()

    if (orgError || !org) {
      // Cleanup Stripe customer
      await stripe.customers.del(stripeCustomer.id)
      return NextResponse.json(
        { error: "Erro ao criar organização." },
        { status: 500 }
      )
    }

    // 4. Create auth user with org_id in metadata
    const { data: authData, error: authError } =
      await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          name,
          organization_id: org.id,
          role: "admin",
        },
      })

    if (authError || !authData.user) {
      // Cleanup: delete org and Stripe customer
      await supabase.from("organizations").delete().eq("id", org.id)
      await stripe.customers.del(stripeCustomer.id)
      return NextResponse.json(
        { error: authError?.message || "Erro ao criar usuário." },
        { status: 500 }
      )
    }

    // 5. Update org with created_by
    await supabase
      .from("organizations")
      .update({ created_by: authData.user.id })
      .eq("id", org.id)

    // 6. Create Stripe Checkout Session with trial
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: stripeCustomer.id,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: planConfig.priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: planConfig.trialDays,
        metadata: { organization_id: org.id, plan },
      },
      metadata: { organization_id: org.id, user_id: authData.user.id },
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/onboarding?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/registro?canceled=true`,
      allow_promotion_codes: true,
    })

    return NextResponse.json({
      checkoutUrl: checkoutSession.url,
      userId: authData.user.id,
      orgId: org.id,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[register] Error:", message)
    return NextResponse.json(
      { error: "Erro interno do servidor." },
      { status: 500 }
    )
  }
}
