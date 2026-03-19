"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useSubscription } from "./subscription-provider"
import { Button } from "@/components/ui/button"
import { X, AlertTriangle, Clock, CreditCard } from "lucide-react"

export function TrialBanner() {
  const { subscription, trialDaysLeft, isReadOnly } = useSubscription()
  const [dismissed, setDismissed] = useState(false)
  const router = useRouter()

  if (!subscription || subscription.is_demo || dismissed) return null

  const { subscription_status } = subscription

  // Don't show for active paid subscriptions
  if (subscription_status === "active") return null

  // Trial expired or canceled — red blocking banner
  if (isReadOnly) {
    return (
      <div className="bg-red-50 border-b border-red-200 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0" />
          <p className="text-[13px] text-red-700 font-medium">
            {subscription_status === "canceled"
              ? "Sua assinatura foi cancelada. Assine para continuar usando o Carvão Connect."
              : "Seu período de teste expirou. Assine para continuar usando o Carvão Connect."}
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => router.push("/planos")}
          className="bg-red-600 hover:bg-red-700 text-white text-[12px] h-7 rounded-lg flex-shrink-0"
        >
          <CreditCard className="h-3 w-3 mr-1.5" />
          Assinar agora
        </Button>
      </div>
    )
  }

  // Past due — yellow warning banner
  if (subscription_status === "past_due") {
    return (
      <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
          <p className="text-[13px] text-amber-700 font-medium">
            Houve um problema com o pagamento da sua assinatura. Atualize o método de pagamento.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            const res = await fetch("/api/portal", { method: "POST" })
            const data = await res.json()
            if (data.url) window.location.href = data.url
          }}
          className="border-amber-300 text-amber-700 hover:bg-amber-100 text-[12px] h-7 rounded-lg flex-shrink-0"
        >
          Atualizar pagamento
        </Button>
      </div>
    )
  }

  // Trial active — show days remaining
  if (subscription_status === "trialing" && trialDaysLeft !== null) {
    const isUrgent = trialDaysLeft <= 3

    return (
      <div
        className={`border-b px-4 py-2 flex items-center justify-between ${
          isUrgent
            ? "bg-amber-50 border-amber-200"
            : "bg-blue-50 border-blue-200"
        }`}
      >
        <div className="flex items-center gap-2">
          <Clock
            className={`h-3.5 w-3.5 flex-shrink-0 ${
              isUrgent ? "text-amber-600" : "text-blue-600"
            }`}
          />
          <p
            className={`text-[13px] font-medium ${
              isUrgent ? "text-amber-700" : "text-blue-700"
            }`}
          >
            {trialDaysLeft === 0
              ? "Seu teste grátis expira hoje."
              : trialDaysLeft === 1
                ? "Seu teste grátis expira amanhã."
                : `Você tem ${trialDaysLeft} dias restantes no teste grátis.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setDismissed(true)}
            className="h-7 w-7 p-0 text-muted-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    )
  }

  return null
}
