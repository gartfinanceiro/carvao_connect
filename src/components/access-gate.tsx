"use client"

import { useSubscription } from "@/components/subscription-provider"
import { type ModuleKey, getDefaultRoute } from "@/lib/permissions"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

interface AccessGateProps {
  module: ModuleKey
  children: React.ReactNode
}

export function AccessGate({ module, children }: AccessGateProps) {
  const { hasAccess, permissions, loading } = useSubscription()
  const router = useRouter()
  const allowed = hasAccess(module)

  useEffect(() => {
    if (!loading && !allowed) {
      router.replace(getDefaultRoute(permissions))
    }
  }, [loading, allowed, permissions, router])

  if (loading) return null
  if (!allowed) return null

  return <>{children}</>
}
