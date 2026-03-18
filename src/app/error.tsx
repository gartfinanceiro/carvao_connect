"use client"

import { Button } from "@/components/ui/button"
import { Leaf } from "lucide-react"
import Link from "next/link"

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <Leaf className="h-12 w-12 text-[#1B4332] mb-4" />
      <h1 className="text-2xl font-bold mb-2">Algo deu errado</h1>
      <p className="text-muted-foreground mb-6 max-w-sm">
        Ocorreu um erro inesperado. Tente novamente ou volte para a página
        inicial.
      </p>
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          onClick={reset}
        >
          Tentar novamente
        </Button>
        <Link href="/">
          <Button className="bg-[#1B4332] hover:bg-[#2D6A4F]">
            Voltar ao início
          </Button>
        </Link>
      </div>
    </div>
  )
}
