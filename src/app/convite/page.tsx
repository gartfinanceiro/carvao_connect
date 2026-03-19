"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, ArrowLeft, Check, Users } from "lucide-react"

export default function ConvitePage() {
  return (
    <Suspense>
      <ConviteContent />
    </Suspense>
  )
}

interface InviteInfo {
  email: string
  role: string
  orgName: string
  invitedByName: string
  expiresAt: string
}

function ConviteContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")

  const [info, setInfo] = useState<InviteInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState("")
  const [name, setName] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!token) {
      setErrorMsg("Link de convite inválido.")
      setLoading(false)
      return
    }

    async function fetchInfo() {
      const res = await fetch(`/api/invites/info?token=${token}`)
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error || "Convite inválido.")
      } else {
        setInfo(data)
      }
      setLoading(false)
    }
    fetchInfo()
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg("")

    if (password !== confirmPassword) {
      setErrorMsg("As senhas não coincidem.")
      return
    }

    if (password.length < 6) {
      setErrorMsg("A senha deve ter pelo menos 6 caracteres.")
      return
    }

    setSubmitting(true)

    try {
      const res = await fetch("/api/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, name, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setErrorMsg(data.error || "Erro ao aceitar convite.")
        setSubmitting(false)
        return
      }

      setSuccess(true)
      setTimeout(() => router.push("/login"), 2000)
    } catch {
      setErrorMsg("Erro de conexão.")
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F7F7]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F7F7]">
        <div className="text-center space-y-4">
          <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
            <Check className="h-6 w-6 text-emerald-600" />
          </div>
          <h1 className="text-xl font-bold">Conta criada!</h1>
          <p className="text-sm text-muted-foreground">Redirecionando para o login...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen">
      {/* Left panel */}
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
            Junte-se à<br />equipe
          </h2>
          <p className="text-white/50 text-[17px] max-w-[420px] leading-relaxed">
            Você foi convidado para usar o Carvão Connect. Crie sua conta para começar.
          </p>
          <ul className="space-y-3 pt-2">
            {[
              "Acesso ao CRM de fornecedores",
              "Registrar interações e follow-ups",
              "Acompanhar alertas e cargas",
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
          &copy; 2026 Carvão Connect. Sete Lagoas, MG.
        </p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center px-6 bg-[#F7F7F7]">
        <div className="w-full max-w-[460px]">
          <Link href="/" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#737373] hover:text-[#111] transition-colors mb-8">
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar ao site
          </Link>

          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <Image src="/icon-original.png" alt="Carvão Connect" width={32} height={32} />
            <span className="text-[16px] font-bold text-[#111]">Carvão Connect</span>
          </div>

          {errorMsg && !info ? (
            <div className="space-y-4">
              <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
                <span className="text-red-600 text-lg font-bold">!</span>
              </div>
              <h1 className="text-[24px] font-extrabold tracking-tight text-[#111]">Convite inválido</h1>
              <p className="text-[14px] text-[#737373]">{errorMsg}</p>
              <Link href="/login" className="text-[14px] text-[#1B4332] font-bold hover:underline">
                Ir para o login
              </Link>
            </div>
          ) : info ? (
            <>
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-9 w-9 rounded-lg bg-[#1B4332] flex items-center justify-center">
                    <Users className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="text-[12px] text-[#737373]">Convite para</p>
                    <p className="text-[15px] font-bold text-[#111]">{info.orgName}</p>
                  </div>
                </div>
                <h1 className="text-[24px] font-extrabold tracking-tight text-[#111]">Criar sua conta</h1>
                <p className="text-[14px] text-[#737373] mt-1.5">
                  Convidado por {info.invitedByName} · Função: {info.role === "admin" ? "Administrador" : "Membro"}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-[13px] font-semibold text-[#111]">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={info.email}
                    disabled
                    className="rounded-xl h-11 border-[#E5E5E5] bg-[#F5F5F5] text-[14px]"
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

                {errorMsg && (
                  <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    <p className="text-[13px] text-red-600 font-medium">{errorMsg}</p>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full h-11 rounded-xl bg-[#1B4332] hover:bg-[#2D6A4F] text-white font-bold text-[14px] active:scale-[0.97] transition-all duration-200 mt-2"
                  disabled={submitting}
                >
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Aceitar convite e criar conta
                </Button>
              </form>

              <p className="mt-6 text-center text-[14px] text-[#737373]">
                Já tem conta?{" "}
                <Link href="/login" className="text-[#1B4332] font-bold hover:underline">
                  Entrar
                </Link>
              </p>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
