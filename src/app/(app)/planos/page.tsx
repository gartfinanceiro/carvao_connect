"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Check, Zap, Building2, Loader2, ArrowLeft } from "lucide-react"
import { useSubscription } from "@/components/subscription-provider"
import { toast } from "sonner"

const plans = [
  {
    key: "starter" as const,
    name: "Starter",
    price: "R$ 197",
    period: "/mês",
    icon: Building2,
    iconBg: "bg-[#F5F5F5]",
    iconColor: "text-[#737373]",
    features: [
      "Até 50 fornecedores",
      "Até 2 usuários",
      "Alertas automáticos",
      "Timeline de interações",
      "Registro de descargas",
    ],
    notIncluded: ["WhatsApp + IA"],
  },
  {
    key: "professional" as const,
    name: "Professional",
    price: "R$ 497",
    period: "/mês",
    popular: true,
    icon: Zap,
    iconBg: "bg-[#1B4332]",
    iconColor: "text-white",
    features: [
      "Até 200 fornecedores",
      "Até 5 usuários",
      "WhatsApp + IA integrados",
      "Alertas automáticos",
      "Timeline de interações",
      "Registro de descargas",
    ],
    notIncluded: [],
  },
]

export default function PlanosPage() {
  const router = useRouter()
  const { subscription } = useSubscription()
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)

  async function handleSelectPlan(planKey: string) {
    if (!subscription?.has_stripe) {
      toast.error("Configure sua assinatura para mudar de plano.")
      return
    }

    setLoadingPlan(planKey)

    try {
      const res = await fetch("/api/portal", { method: "POST" })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        toast.error("Erro ao abrir portal de cobrança.")
      }
    } catch {
      toast.error("Erro de conexão.")
    }

    setLoadingPlan(null)
  }

  const currentPlan = subscription?.plan

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#737373] hover:text-[#111] transition-colors mb-6"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Voltar
      </button>

      <div className="text-center mb-8">
        <h1 className="text-[28px] font-extrabold tracking-tight text-[#111]">
          Escolha o plano ideal
        </h1>
        <p className="text-[15px] text-[#737373] mt-2">
          Todos os planos incluem acesso completo às funcionalidades do plano. Cancele quando quiser.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {plans.map((plan) => {
          const isCurrent = currentPlan === plan.key
          const Icon = plan.icon

          return (
            <div
              key={plan.key}
              className={`relative rounded-2xl border-2 p-6 bg-white transition-all ${
                plan.popular
                  ? "border-[#1B4332] shadow-md"
                  : "border-[#E5E5E5]"
              }`}
            >
              {plan.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold uppercase bg-[#1B4332] text-white px-3 py-1 rounded-full">
                  Mais popular
                </span>
              )}

              <div className="flex items-center gap-3 mb-4">
                <div
                  className={`h-10 w-10 rounded-xl flex items-center justify-center ${plan.iconBg}`}
                >
                  <Icon className={`h-5 w-5 ${plan.iconColor}`} />
                </div>
                <div>
                  <h3 className="text-[17px] font-bold text-[#111]">{plan.name}</h3>
                  {isCurrent && (
                    <span className="text-[11px] font-semibold text-[#52B788]">Plano atual</span>
                  )}
                </div>
              </div>

              <div className="mb-6">
                <span className="text-[32px] font-extrabold text-[#111]">{plan.price}</span>
                <span className="text-[15px] text-[#737373]">{plan.period}</span>
              </div>

              <ul className="space-y-2.5 mb-6">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-[14px] text-[#333]">
                    <Check className="h-4 w-4 text-[#52B788] flex-shrink-0" />
                    {f}
                  </li>
                ))}
                {plan.notIncluded.map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-[14px] text-[#999] line-through">
                    <Check className="h-4 w-4 text-[#D4D4D4] flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              <Button
                className={`w-full h-11 rounded-xl font-bold text-[14px] ${
                  isCurrent
                    ? "bg-[#F5F5F5] text-[#737373] hover:bg-[#EBEBEB]"
                    : plan.popular
                      ? "bg-[#1B4332] hover:bg-[#2D6A4F] text-white"
                      : "bg-[#111] hover:bg-[#333] text-white"
                }`}
                onClick={() => handleSelectPlan(plan.key)}
                disabled={isCurrent || loadingPlan === plan.key}
              >
                {loadingPlan === plan.key && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {isCurrent ? "Plano atual" : "Selecionar plano"}
              </Button>
            </div>
          )
        })}
      </div>

      <div className="mt-8 text-center space-y-2">
        <p className="text-[13px] text-[#999]">
          Precisa de mais? Entre em contato para o plano Enterprise com recursos ilimitados.
        </p>
      </div>
    </div>
  )
}
