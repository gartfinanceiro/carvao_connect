"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, ArrowLeft } from "lucide-react"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError("Email ou senha inválidos.")
      setLoading(false)
      return
    }

    router.push("/dashboard")
    router.refresh()
  }

  return (
    <div className="flex min-h-screen">
      {/* Left panel — green with brand messaging */}
      <div className="hidden lg:flex lg:w-[55%] bg-[#1B4332] flex-col justify-between p-12 relative overflow-hidden">
        {/* Subtle dot pattern */}
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

        <div className="relative space-y-5">
          <h2 className="text-[40px] font-extrabold text-white leading-[1.15] tracking-tight">
            Controle total<br />da sua operação<br />de carvão
          </h2>
          <p className="text-white/50 text-[17px] max-w-[420px] leading-relaxed">
            Fornecedores, cargas, documentos e alertas em um só lugar — para você focar no que importa.
          </p>
          <div className="flex items-center gap-6 pt-2">
            <div>
              <p className="text-[28px] font-extrabold text-white">200+</p>
              <p className="text-[13px] text-white/40 font-medium">fornecedores gerenciados</p>
            </div>
            <div className="w-px h-10 bg-white/10" />
            <div>
              <p className="text-[28px] font-extrabold text-white">5 min</p>
              <p className="text-[13px] text-white/40 font-medium">para começar a usar</p>
            </div>
          </div>
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
            <h1 className="text-[24px] font-extrabold tracking-tight text-[#111]">Entrar na sua conta</h1>
            <p className="text-[14px] text-[#737373] mt-1.5">
              Informe suas credenciais para acessar o painel
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
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
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
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
              Entrar
            </Button>
          </form>

          <p className="mt-6 text-center text-[14px] text-[#737373]">
            Não tem conta?{" "}
            <Link href="/registro" className="text-[#1B4332] font-bold hover:underline">
              Começar grátis
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
