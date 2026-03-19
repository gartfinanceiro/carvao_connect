"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, ArrowLeft, Check } from "lucide-react"
import { toast } from "sonner"

export default function RegistroPage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
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

    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
      },
    })

    if (error) {
      setError("Erro ao criar conta. Tente novamente.")
      setLoading(false)
      return
    }

    toast.success("Conta criada com sucesso!")
    router.push("/dashboard")
    router.refresh()
  }

  const benefits = [
    "3 dias grátis com todas as funcionalidades",
    "Integração WhatsApp com IA inclusa",
    "Alertas automáticos de cargas e documentos",
    "Cancele quando quiser",
  ]

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
            Crie sua conta e tenha acesso completo por 3 dias. Sem complicação.
          </p>
          <ul className="space-y-3 pt-2">
            {benefits.map((b) => (
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

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center px-6 bg-[#F7F7F7]">
        <div className="w-full max-w-[380px]">
          {/* Back to site */}
          <Link href="/" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#737373] hover:text-[#111] transition-colors mb-8">
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar ao site
          </Link>

          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <Image src="/icon-original.png" alt="Carvão Connect" width={32} height={32} />
            <span className="text-[16px] font-bold text-[#111]">Carvão Connect</span>
          </div>

          <div className="mb-8">
            <h1 className="text-[24px] font-extrabold tracking-tight text-[#111]">Criar sua conta</h1>
            <p className="text-[14px] text-[#737373] mt-1.5">
              Preencha seus dados para começar a testar
            </p>
          </div>

          <form onSubmit={handleRegister} className="space-y-4">
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
              <Label htmlFor="confirmPassword" className="text-[13px] font-semibold text-[#111]">Confirmar senha</Label>
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
              Começar grátis por 3 dias →
            </Button>
          </form>

          <p className="mt-6 text-center text-[14px] text-[#737373]">
            Já tem conta?{" "}
            <Link href="/login" className="text-[#1B4332] font-bold hover:underline">
              Entrar
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
