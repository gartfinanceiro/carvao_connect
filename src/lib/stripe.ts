import Stripe from "stripe"

let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2026-02-25.clover",
      typescript: true,
    })
  }
  return _stripe
}

// Legacy export for convenience — use getStripe() in API routes
export const stripe = new Proxy({} as Stripe, {
  get(_, prop) {
    return (getStripe() as unknown as Record<string | symbol, unknown>)[prop]
  },
})

export const PLANS = {
  starter: {
    name: "Starter",
    price: "R$ 197/mês",
    priceId: process.env.STRIPE_STARTER_PRICE_ID || "",
    trialDays: 7,
    limits: {
      max_suppliers: 50,
      max_users: 2,
      whatsapp_enabled: false,
    },
  },
  professional: {
    name: "Professional",
    price: "R$ 497/mês",
    priceId: process.env.STRIPE_PROFESSIONAL_PRICE_ID || "",
    trialDays: 3,
    limits: {
      max_suppliers: 200,
      max_users: 5,
      whatsapp_enabled: true,
    },
  },
} as const

export type PlanKey = keyof typeof PLANS
