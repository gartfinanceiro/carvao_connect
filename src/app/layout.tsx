import type { Metadata } from "next"
import { Plus_Jakarta_Sans, Inter } from "next/font/google"
import { SpeedInsights } from "@vercel/speed-insights/next"
import { Toaster } from "@/components/ui/sonner"
import "./globals.css"

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
})

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
})

export const metadata: Metadata = {
  title: "Carvão Connect — Gestão de Compras de Carvão",
  description:
    "CRM de compras de carvão vegetal para siderúrgicas e guseiras. Cadastro de fornecedores, acompanhamento de interações e alertas inteligentes.",
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" data-scroll-behavior="smooth">
      <body className={`${jakarta.variable} ${inter.variable} font-sans antialiased`}>
        {children}
        <SpeedInsights />
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}
