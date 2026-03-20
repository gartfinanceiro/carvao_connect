"use client"

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  hasModuleAccess,
  canSeeFinancials as checkFinancials,
  type ModuleKey,
  type Permissions,
  type ProfileTemplate,
} from "@/lib/permissions"

export interface SubscriptionInfo {
  organization_id: string
  organization_name: string
  plan: string
  plan_limits: {
    max_suppliers: number
    max_users: number
    whatsapp_enabled: boolean
  }
  trial_ends_at: string | null
  subscription_status: string
  current_period_end: string | null
  has_stripe: boolean
  is_demo: boolean
  role: "admin" | "member"
  permissions: Permissions | null
  profile_template: ProfileTemplate | null
}

interface SubscriptionContextType {
  subscription: SubscriptionInfo | null
  loading: boolean
  isReadOnly: boolean
  isAdmin: boolean
  trialDaysLeft: number | null
  permissions: Permissions | null
  hasAccess: (module: ModuleKey) => boolean
  canSeeFinancials: boolean
  refresh: () => Promise<void>
}

const SubscriptionContext = createContext<SubscriptionContextType>({
  subscription: null,
  loading: true,
  isReadOnly: false,
  isAdmin: false,
  trialDaysLeft: null,
  permissions: null,
  hasAccess: () => true,
  canSeeFinancials: true,
  refresh: async () => {},
})

export function useSubscription() {
  return useContext(SubscriptionContext)
}

export function SubscriptionProvider({
  children,
  initialData,
}: {
  children: ReactNode
  initialData?: SubscriptionInfo | null
}) {
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(
    initialData ?? null
  )
  const [loading, setLoading] = useState(!initialData)

  const fetchSubscription = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("get_my_subscription")
    if (!error && data) {
      setSubscription(data as unknown as SubscriptionInfo)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!initialData) {
      fetchSubscription()
    }
  }, [initialData, fetchSubscription])

  // Calculate derived state
  const trialDaysLeft = (() => {
    if (!subscription?.trial_ends_at) return null
    if (subscription.subscription_status !== "trialing") return null
    const diff = new Date(subscription.trial_ends_at).getTime() - Date.now()
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
  })()

  const isReadOnly = (() => {
    if (!subscription) return false
    if (subscription.is_demo) return false

    const { subscription_status, trial_ends_at } = subscription

    if (subscription_status === "canceled") return true

    if (
      subscription_status === "trialing" &&
      trial_ends_at &&
      new Date(trial_ends_at) < new Date()
    ) {
      return true
    }

    return false
  })()

  const isAdmin = subscription?.role === "admin" || subscription?.is_demo === true
  const permissions = isAdmin ? null : (subscription?.permissions ?? null)
  const canSeeFinancialsValue = checkFinancials(permissions)

  const hasAccess = useCallback(
    (module: ModuleKey) => hasModuleAccess(permissions, module),
    [permissions]
  )

  return (
    <SubscriptionContext.Provider
      value={{
        subscription,
        loading,
        isReadOnly,
        isAdmin,
        trialDaysLeft,
        permissions,
        hasAccess,
        canSeeFinancials: canSeeFinancialsValue,
        refresh: fetchSubscription,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  )
}
