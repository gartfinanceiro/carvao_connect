import { NextResponse } from "next/server"
import { stripe, PLANS } from "@/lib/stripe"
import { createAdminClient } from "@/lib/supabase/admin"
import type Stripe from "stripe"

// Helper: get current_period_end from subscription items (clover API moved it there)
function getPeriodEnd(subscription: Stripe.Subscription): string | null {
  const items = subscription.items?.data
  if (items && items.length > 0 && items[0].current_period_end) {
    return new Date(items[0].current_period_end * 1000).toISOString()
  }
  // Fallback: use cancel_at or ended_at
  if (subscription.cancel_at) {
    return new Date(subscription.cancel_at * 1000).toISOString()
  }
  return null
}

export async function POST(request: Request) {
  const body = await request.text()
  const signature = request.headers.get("stripe-signature")

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    console.error("[stripe-webhook] Signature verification failed:", err)
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  const supabase = createAdminClient()

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        const orgId = session.metadata?.organization_id
        const metaPlan = session.metadata?.plan

        if (!orgId) {
          console.error("[stripe-webhook] No organization_id in metadata")
          break
        }

        // Retrieve subscription details
        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id

        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
            expand: ["items.data"],
          })
          const planKey = subscription.metadata?.plan as keyof typeof PLANS | undefined
          const planConfig = planKey ? PLANS[planKey] : null
          const periodEnd = getPeriodEnd(subscription)

          const updatePayload: Record<string, unknown> = {
            stripe_customer_id:
              typeof session.customer === "string"
                ? session.customer
                : session.customer?.id,
            stripe_subscription_id: subscriptionId,
            subscription_status: subscription.status === "trialing" ? "trialing" : "active",
            plan: planKey || metaPlan || "starter",
            plan_limits: planConfig?.limits || PLANS.starter.limits,
          }

          if (periodEnd) {
            updatePayload.current_period_end = periodEnd
          }

          await supabase
            .from("organizations")
            .update(updatePayload)
            .eq("id", orgId)
        }
        break
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription
        const orgId = subscription.metadata?.organization_id

        // Find org by stripe_subscription_id if no metadata
        let targetOrgId = orgId
        if (!targetOrgId) {
          const { data: org } = await supabase
            .from("organizations")
            .select("id")
            .eq("stripe_subscription_id", subscription.id)
            .single()
          targetOrgId = org?.id
        }

        if (!targetOrgId) {
          console.error("[stripe-webhook] Cannot find org for subscription:", subscription.id)
          break
        }

        const planKey = subscription.metadata?.plan as keyof typeof PLANS | undefined
        const planConfig = planKey ? PLANS[planKey] : null
        const periodEnd = getPeriodEnd(subscription)

        const updateData: Record<string, unknown> = {
          subscription_status: subscription.status === "trialing" ? "trialing" : subscription.status,
        }

        if (periodEnd) {
          updateData.current_period_end = periodEnd
        }

        if (planConfig) {
          updateData.plan = planKey
          updateData.plan_limits = planConfig.limits
        }

        // Handle cancellation at period end
        if (subscription.cancel_at_period_end) {
          updateData.subscription_status = "canceled"
        }

        await supabase
          .from("organizations")
          .update(updateData)
          .eq("id", targetOrgId)

        break
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription

        const { data: org } = await supabase
          .from("organizations")
          .select("id")
          .eq("stripe_subscription_id", subscription.id)
          .single()

        if (org) {
          await supabase
            .from("organizations")
            .update({
              subscription_status: "canceled",
              plan: "canceled",
            })
            .eq("id", org.id)
        }
        break
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice
        // In clover API, subscription is under parent.subscription_details
        const subDetails = invoice.parent?.subscription_details
        const subscriptionId =
          typeof subDetails?.subscription === "string"
            ? subDetails.subscription
            : subDetails?.subscription?.id

        if (subscriptionId) {
          const { data: org } = await supabase
            .from("organizations")
            .select("id")
            .eq("stripe_subscription_id", subscriptionId)
            .single()

          if (org) {
            await supabase
              .from("organizations")
              .update({ subscription_status: "past_due" })
              .eq("id", org.id)
          }
        }
        break
      }
    }
  } catch (err) {
    console.error("[stripe-webhook] Error handling event:", err)
    return NextResponse.json({ error: "Webhook handler error" }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
