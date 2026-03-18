import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Leaf } from "lucide-react"

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <Leaf className="h-12 w-12 text-[#1B4332] mb-4" />
      <h1 className="text-4xl font-bold mb-2">404</h1>
      <p className="text-lg text-muted-foreground mb-6">
        Página não encontrada
      </p>
      <Link href="/">
        <Button className="bg-[#1B4332] hover:bg-[#2D6A4F]">
          Voltar ao início
        </Button>
      </Link>
    </div>
  )
}
