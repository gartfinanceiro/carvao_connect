"use client"

import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, ArrowLeft, Check, Building2, Zap } from "lucide-react"

type PlanKey = "starter" | "professional"

const plans = {
  starter: {
    name: "Starter",
    price: "R$ 197",
    period: "/mês",
    trial: "7 dias grátis",
    features: [
      "Até 50 fornecedores",
      "Até 2 usuários",
      "Alertas automáticos",
      "Timeline de interações",
    ],
  },
  professional: {
    name: "Professional",
    price: "R$ 497",
    period: "/mês",
    trial: "3 dias grátis",
    popular: true,
    features: [
      "Até 200 fornecedores",
      "Até 5 usuários",
      "WhatsApp + IA integrados",
      "Alertas automáticos",
      "Timeline de interações",
    ],
  },
} as const

export default function RegistroPage() {
  return (
    <Suspense>
      <RegistroContent />
    </Suspense>
  )
}

function RegistroContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const canceled = searchParams.get("canceled")

  const [step, setStep] = useState<"plan" | "form">(canceled ? "form" : "plan")
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>("starter")

  const [name, setName] = useState("")
  const [companyName, setCompanyName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState(canceled ? "Checkout cancelado. Tente novamente." : "")
  const [loading, setLoading] = useState(false)

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    if (password !== confirmPassword) {
      setError("As senhas não coincidem.")
      return
    }

    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.")
      return
    }

    setLoading(true)

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          companyName,
          plan: selectedPlan,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Erro ao criar conta.")
        setLoading(false)
        return
      }

      // Redirect to Stripe Checkout
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl
      } else {
        router.push("/onboarding")
      }
    } catch {
      setError("Erro de conexão. Tente novamente.")
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Left panel — green with benefits */}
      <div className="hidden lg:flex lg:w-[55%] bg-[#1B4332] flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
          backgroundSize: "32px 32px"
        }} />

        <div className="relative">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/icon-original.png" alt="Carvão Connect" width={32} height={32} />
            <span className="text-[16px] font-bold text-white">Carvão Connect</span>
          </Link>
        </div>

        <div className="relative space-y-6">
          <h2 className="text-[40px] font-extrabold text-white leading-[1.15] tracking-tight">
            Comece agora,<br />controle sempre
          </h2>
          <p className="text-white/50 text-[17px] max-w-[420px] leading-relaxed">
            Crie sua conta e tenha acesso completo durante o período de teste. Sem complicação.
          </p>
          <ul className="space-y-3 pt-2">
            {[
              "Período de teste grátis com todas as funcionalidades",
              "Integração WhatsApp com IA no Professional",
              "Alertas automáticos de cargas e documentos",
              "Cancele quando quiser",
            ].map((b) => (
              <li key={b} className="flex items-center gap-3">
                <div className="h-5 w-5 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                  <Check className="h-3 w-3 text-[#52B788]" />
                </div>
                <span className="text-[15px] text-white/70 font-medium">{b}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-white/20 text-[13px]">
          © 2026 Carvão Connect. Sete Lagoas, MG.
        </p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center px-6 bg-[#F7F7F7]">
        <div className="w-full max-w-[460px]">
          {/* Back */}
          <Link href="/" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#737373] hover:text-[#111] transition-colors mb-8">
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar ao site
          </Link>

          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <Image src="/icon-original.png" alt="Carvão Connect" width={32} height={32} />
            <span className="text-[16px] font-bold text-[#111]">Carvão Connect</span>
          </div>

          {step === "plan" ? (
            <>
              <div className="mb-6">
                <h1 className="text-[24px] font-extrabold tracking-tight text-[#111]">Escolha seu plano</h1>
                <p className="text-[14px] text-[#737373] mt-1.5">
                  Comece com um teste grátis. Cancele quando quiser.
                </p>
              </div>

              <div className="space-y-3">
                {(Object.entries(plans) as [PlanKey, typeof plans[PlanKey]][]).map(
                  ([key, plan]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedPlan(key)}
                      className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                        selectedPlan === key
                          ? "border-[#1B4332] bg-white shadow-sm"
                          : "border-[#E5E5E5] bg-white hover:border-[#D4D4D4]"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${
                            key === "professional" ? "bg-[#1B4332]" : "bg-[#F5F5F5]"
                          }`}>
                            {key === "professional" ? (
                              <Zap className="h-4 w-4 text-white" />
                            ) : (
                              <Building2 className="h-4 w-4 text-[#737373]" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-[15px] font-bold text-[#111]">{plan.name}</span>
                              {"popular" in plan && plan.popular && (
                                <span className="text-[10px] font-bold uppercase bg-[#1B4332] text-white px-1.5 py-0.5 rounded">
                                  Popular
                                </span>
                              )}
                            </div>
                            <span className="text-[12px] text-[#52B788] font-semibold">{plan.trial}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[20px] font-extrabold text-[#111]">{plan.price}</span>
                          <span className="text-[13px] text-[#737373]">{plan.period}</span>
                        </div>
                      </div>
                      <ul className="mt-3 space-y-1.5">
                        {plan.features.map((f) => (
                          <li key={f} className="flex items-center gap-2 text-[13px] text-[#737373]">
                            <Check className="h-3 w-3 text-[#52B788] flex-shrink-0" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </button>
                  )
                )}
              </div>

              <Button
                onClick={() => setStep("form")}
                className="w-full h-11 rounded-xl bg-[#1B4332] hover:bg-[#2D6A4F] text-white font-bold text-[14px] active:scale-[0.97] transition-all duration-200 mt-4"
              >
                Continuar com {plans[selectedPlan].name} →
              </Button>

              <p className="mt-6 text-center text-[14px] text-[#737373]">
                Já tem conta?{" "}
                <Link href="/login" className="text-[#1B4332] font-bold hover:underline">
                  Entrar
                </Link>
              </p>
            </>
          ) : (
            <>
              <div className="mb-6">
                <button
                  type="button"
                  onClick={() => { setStep("plan"); setError("") }}
                  className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#737373] hover:text-[#111] transition-colors mb-4"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Trocar plano
                </button>
                <h1 className="text-[24px] font-extrabold tracking-tight text-[#111]">Criar sua conta</h1>
                <p className="text-[14px] text-[#737373] mt-1.5">
                  Plano {plans[selectedPlan].name} — {plans[selectedPlan].trial}
                </p>
              </div>

              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="companyName" className="text-[13px] font-semibold text-[#111]">Nome da empresa</Label>
                  <Input
                    id="companyName"
                    type="text"
                    placeholder="Ex: Siderúrgica São Paulo"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    required
                    className="rounded-xl h-11 border-[#E5E5E5] bg-white focus:border-[#1B4332] focus:ring-[#1B4332]/10 text-[14px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-[13px] font-semibold text-[#111]">Nome completo</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Seu nome"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="rounded-xl h-11 border-[#E5E5E5] bg-white focus:border-[#1B4332] focus:ring-[#1B4332]/10 text-[14px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-[13px] font-semibold text-[#111]">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="rounded-xl h-11 border-[#E5E5E5] bg-white focus:border-[#1B4332] focus:ring-[#1B4332]/10 text-[14px]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="password" className="text-[13px] font-semibold text-[#111]">Senha</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Mínimo 6 caracteres"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      className="rounded-xl h-11 border-[#E5E5E5] bg-white focus:border-[#1B4332] focus:ring-[#1B4332]/10 text-[14px]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="confirmPassword" className="text-[13px] font-semibold text-[#111]">Confirmar</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="Repita a senha"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={6}
                      className="rounded-xl h-11 border-[#E5E5E5] bg-white focus:border-[#1B4332] focus:ring-[#1B4332]/10 text-[14px]"
                    />
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    <p className="text-[13px] text-red-600 font-medium">{error}</p>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full h-11 rounded-xl bg-[#1B4332] hover:bg-[#2D6A4F] text-white font-bold text-[14px] active:scale-[0.97] transition-all duration-200 mt-2"
                  disabled={loading}
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Criar conta e iniciar teste grátis →
                </Button>

                <p className="text-[11px] text-[#999] text-center mt-2">
                  Ao criar sua conta você concorda com os Termos de Uso e Política de Privacidade.
                </p>
              </form>

              <p className="mt-6 text-center text-[14px] text-[#737373]">
                Já tem conta?{" "}
                <Link href="/login" className="text-[#1B4332] font-bold hover:underline">
                  Entrar
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
