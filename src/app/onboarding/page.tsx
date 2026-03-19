"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
import { createClient } from "@/lib/supabase/client"
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function OnboardingPage() {
  return (
    <Suspense>
      <OnboardingContent />
    </Suspense>
  )
}

function OnboardingContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const sessionId = searchParams.get("session_id")

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
  const [errorMsg, setErrorMsg] = useState("")

  useEffect(() => {
    if (!sessionId) {
      setStatus("error")
      setErrorMsg("Sessão de checkout não encontrada.")
      return
    }

    async function verifyAndLogin() {
      try {
        const res = await fetch("/api/verify-checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        })

        const data = await res.json()

        if (!res.ok) {
          setStatus("error")
          setErrorMsg(data.error || "Erro ao verificar checkout.")
          return
        }

        // Auto-login via OTP verification
        if (data.tokenHash && data.email) {
          const supabase = createClient()
          const { error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: data.tokenHash,
            type: "magiclink",
          })

          if (verifyError) {
            // Fallback: redirect to login
            setStatus("success")
            setTimeout(() => router.push("/login"), 2000)
            return
          }
        }

        setStatus("success")
        setTimeout(() => {
          router.push("/dashboard")
          router.refresh()
        }, 1500)
      } catch {
        setStatus("error")
        setErrorMsg("Erro de conexão.")
      }
    }

    verifyAndLogin()
  }, [sessionId, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F7F7] px-6">
      <div className="w-full max-w-[400px] text-center">
        <div className="flex justify-center mb-8">
          <Image src="/icon-original.png" alt="Carvão Connect" width={48} height={48} />
        </div>

        {status === "loading" && (
          <div className="space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-[#1B4332] mx-auto" />
            <h1 className="text-[20px] font-bold text-[#111]">Configurando sua conta...</h1>
            <p className="text-[14px] text-[#737373]">
              Aguarde enquanto preparamos tudo para você.
            </p>
          </div>
        )}

        {status === "success" && (
          <div className="space-y-4">
            <CheckCircle2 className="h-12 w-12 text-[#52B788] mx-auto" />
            <h1 className="text-[20px] font-bold text-[#111]">Conta criada com sucesso!</h1>
            <p className="text-[14px] text-[#737373]">
              Redirecionando para o painel...
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-4">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
            <h1 className="text-[20px] font-bold text-[#111]">Algo deu errado</h1>
            <p className="text-[14px] text-[#737373]">{errorMsg}</p>
            <div className="flex gap-3 justify-center pt-2">
              <Button
                variant="outline"
                onClick={() => router.push("/registro")}
                className="rounded-xl"
              >
                Tentar novamente
              </Button>
              <Button
                onClick={() => router.push("/login")}
                className="rounded-xl bg-[#1B4332] hover:bg-[#2D6A4F] text-white"
              >
                Ir para login
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
