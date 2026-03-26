"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { MessageSquare, Lock } from "lucide-react"
import { WhatsAppSetup } from "@/components/whatsapp-setup"
import { useSubscription } from "@/components/subscription-provider"

export function IntegracoesSection() {
  const router = useRouter()
  const { subscription, isAdmin } = useSubscription()
  const whatsappEnabled = subscription?.plan_limits?.whatsapp_enabled ?? false

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Integrações</h2>
        <p className="text-sm text-muted-foreground mt-1">Conexões com serviços externos</p>
      </div>

      <div className="rounded-xl border border-border bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
            <MessageSquare className="h-4 w-4 text-emerald-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">WhatsApp</h3>
            <p className="text-xs text-muted-foreground">Integração com WhatsApp + IA</p>
          </div>
        </div>
        {whatsappEnabled && isAdmin ? (
          <WhatsAppSetup />
        ) : whatsappEnabled && !isAdmin ? (
          <div className="bg-[#F9F9F9] rounded-xl p-4 flex items-center gap-3">
            <MessageSquare className="h-5 w-5 text-emerald-600" />
            <div>
              <p className="text-sm font-medium text-[#333]">WhatsApp ativo</p>
              <p className="text-xs text-muted-foreground">
                A configuração do WhatsApp é gerenciada pelo administrador.
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-[#F9F9F9] rounded-xl p-4 flex items-center gap-3">
            <Lock className="h-5 w-5 text-[#999]" />
            <div>
              <p className="text-sm font-medium text-[#333]">Disponível no Professional</p>
              <p className="text-xs text-muted-foreground">
                Faça upgrade para integrar WhatsApp com IA.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/planos")}
              className="ml-auto text-xs"
            >
              Ver planos
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
