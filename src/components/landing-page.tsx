"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"

// Hook for scroll-triggered animations
function useReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true) },
      { threshold }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold])

  return { ref, visible }
}

function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const { ref, visible } = useReveal()
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(24px)",
        transition: `opacity 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}s, transform 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}s`,
      }}
    >
      {children}
    </div>
  )
}

export function LandingPage() {
  return (
    <div style={{ fontFamily: "var(--font-jakarta, 'Plus Jakarta Sans', system-ui, sans-serif)" }}>
      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/92 backdrop-blur-xl border-b border-[#E5E7EB]">
        <div className="max-w-[1200px] mx-auto flex items-center justify-between px-6 h-16">
          <Link href="/" className="flex items-center gap-2.5 text-[16px] font-extrabold text-[#111]">
            <Image src="/icon-original.png" alt="Carvão Connect" width={28} height={28} />
            Carvão Connect
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <a href="#funcionalidades" className="text-[14px] font-medium text-[#6B7280] hover:text-[#111] transition-colors">Funcionalidades</a>
            <a href="#como-funciona" className="text-[14px] font-medium text-[#6B7280] hover:text-[#111] transition-colors">Como funciona</a>
            <a href="#precos" className="text-[14px] font-medium text-[#6B7280] hover:text-[#111] transition-colors">Preços</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-[14px] font-semibold text-[#1B4332] hover:underline hidden sm:inline">
              Entrar
            </Link>
            <Link href="/registro" className="bg-[#1B4332] text-white px-5 py-2.5 rounded-[10px] text-[14px] font-semibold hover:bg-[#2D6A4F] transition-all duration-200 hover:-translate-y-px active:scale-[0.97]">
              Começar grátis
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO — Animated entry */}
      <section className="pt-[140px] pb-20 px-6 text-center bg-gradient-to-b from-white to-[#F9FAFB]">
        <div className="max-w-[800px] mx-auto">
          <Reveal>
            <div className="inline-flex items-center gap-1.5 bg-[#E8F5E9] text-[#1B4332] text-[13px] font-semibold px-3.5 py-1.5 rounded-full border border-[#D8F3DC] mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-[#52B788]" style={{ animation: "pulse-dot 2s ease-in-out infinite" }} />
              3 dias grátis com todas as funcionalidades
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <h1 className="text-[clamp(36px,5vw,56px)] font-extrabold leading-[1.1] tracking-[-0.03em] text-[#111] mb-5">
              Controle total da sua<br />operação de <span className="text-[#1B4332]">carvão</span>
            </h1>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="text-[18px] text-[#6B7280] max-w-[560px] mx-auto mb-9 leading-relaxed">
              A plataforma feita para quem compra carvão vegetal. Fornecedores, cargas, documentos e alertas em um só lugar — para você focar no que importa.
            </p>
          </Reveal>
          <Reveal delay={0.3}>
            <div className="flex gap-3 justify-center flex-wrap">
              <Link href="/registro" className="bg-[#1B4332] text-white px-7 py-3.5 rounded-xl text-[16px] font-bold hover:bg-[#2D6A4F] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(27,67,50,0.2)] active:scale-[0.97] inline-flex items-center gap-2">
                Testar grátis por 3 dias →
              </Link>
              <a href="#como-funciona" className="bg-transparent text-[#374151] px-7 py-3.5 rounded-xl text-[16px] font-semibold border border-[#E5E7EB] hover:bg-[#F9FAFB] hover:border-[#9CA3AF] transition-all duration-200 active:scale-[0.97]">
                Ver como funciona
              </a>
            </div>
          </Reveal>
          <Reveal delay={0.4}>
            <p className="mt-4 text-[13px] text-[#9CA3AF] font-medium">
              Cancele quando quiser. Inclui integração WhatsApp com IA.
            </p>
          </Reveal>
        </div>
      </section>

      {/* SOCIAL PROOF */}
      <Reveal>
        <section className="py-10 px-6 text-center border-t border-b border-[#E5E7EB] bg-white">
          <p className="text-[14px] text-[#9CA3AF] font-medium">
            Feito para <strong className="text-[#374151] font-bold">siderúrgicas</strong> e <strong className="text-[#374151] font-bold">produtoras de ferro-gusa</strong> de todo o Brasil
          </p>
        </section>
      </Reveal>

      {/* PROBLEM vs SOLUTION */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-[1000px] mx-auto grid md:grid-cols-2 gap-16 md:gap-20">
          <Reveal>
            <div>
              <h2 className="text-[32px] font-extrabold tracking-[-0.02em] leading-[1.2] mb-5">
                Planilha + WhatsApp não escala
              </h2>
              <p className="text-[16px] text-[#6B7280] leading-relaxed mb-6">
                Sua equipe gerencia centenas de fornecedores com Excel e mensagens de WhatsApp. O resultado?
              </p>
              <ul className="flex flex-col gap-4">
                {[
                  "Cargas perdidas porque esqueceu de ligar pro fornecedor",
                  "\"Meu funcionário ligou e eu não sei o que foi falado\"",
                  "Documentos vencendo sem ninguém perceber",
                  "Decisões baseadas em memória, não em dados",
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-[15px] text-[#374151] font-medium" style={{ animation: "none", opacity: 1 }}>
                    <span className="shrink-0 w-6 h-6 rounded-md bg-[#FEE2E2] text-[#EF4444] text-[12px] font-bold flex items-center justify-center">✕</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
          <Reveal delay={0.15}>
            <div>
              <h2 className="text-[32px] font-extrabold tracking-[-0.02em] leading-[1.2] mb-5">
                Carvão Connect resolve
              </h2>
              <p className="text-[16px] text-[#6B7280] leading-relaxed mb-6">
                Uma ferramenta feita para o vocabulário e fluxos do comprador de carvão vegetal.
              </p>
              <ul className="flex flex-col gap-4">
                {[
                  "Alerta automático 7 dias antes de cada carga prometida",
                  "Histórico completo de ligações e combinados por fornecedor",
                  "DCF e documentos com controle de vencimento automático",
                  "Registro de descargas com cálculo de densidade e valor",
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-[15px] text-[#374151] font-medium">
                    <span className="shrink-0 w-6 h-6 rounded-md bg-[#D1FAE5] text-[#16a34a] text-[12px] font-bold flex items-center justify-center">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </section>

      {/* FEATURES */}
      <section id="funcionalidades" className="py-24 px-6 bg-[#F9FAFB]">
        <div className="max-w-[1100px] mx-auto">
          <Reveal>
            <p className="text-[13px] font-bold text-[#1B4332] uppercase tracking-[0.08em] mb-3">Funcionalidades</p>
            <h2 className="text-[32px] font-extrabold tracking-[-0.02em] leading-[1.2] mb-12 max-w-[500px]">
              Tudo que o comprador de carvão precisa
            </h2>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: "👥", title: "Cadastro de fornecedores", desc: "Base completa com capacidade, tipo de carvão, densidade, documentação e múltiplos telefones. Busca e filtros instantâneos." },
              { icon: "📞", title: "Timeline de interações", desc: "Registre cada ligação, WhatsApp ou visita. Notas, cargas prometidas e próximos passos — tudo em um fluxo guiado." },
              { icon: "🔔", title: "Alertas inteligentes", desc: "Follow-ups, retornos automáticos, vencimento de DCF e confirmação de cargas. O sistema lembra por você." },
              { icon: "📦", title: "Registro de descargas", desc: "Volume, pesagem, densidade, umidade, moinha e valor — tudo calculado automaticamente. Histórico completo." },
              { icon: "📄", title: "Gestão de documentos", desc: "Checklist dos 11 documentos essenciais por fornecedor. Anexe PDFs, controle vencimentos e nunca perca uma DCF." },
              { icon: "💬", title: "Integração WhatsApp + IA", desc: "A IA lê suas conversas de WhatsApp e extrai dados automaticamente: cargas prometidas, preços e datas de entrega." },
            ].map((f, i) => (
              <Reveal key={f.title} delay={i * 0.08}>
                <div className="bg-white border border-[#E5E7EB] rounded-2xl p-8 hover:border-[#D8F3DC] hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] hover:-translate-y-1 transition-all duration-300 cursor-default h-full">
                  <div className="w-11 h-11 rounded-xl bg-[#E8F5E9] flex items-center justify-center text-[20px] mb-5">{f.icon}</div>
                  <h3 className="text-[17px] font-bold text-[#111] mb-2">{f.title}</h3>
                  <p className="text-[14px] text-[#6B7280] leading-relaxed">{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="como-funciona" className="py-24 px-6 bg-white">
        <div className="max-w-[900px] mx-auto">
          <Reveal>
            <p className="text-[13px] font-bold text-[#1B4332] uppercase tracking-[0.08em] mb-3">Como funciona</p>
            <h2 className="text-[32px] font-extrabold tracking-[-0.02em] leading-[1.2] mb-12">Comece a usar em 5 minutos</h2>
          </Reveal>
          {[
            { n: "1", title: "Crie sua conta", desc: "Cadastro em 30 segundos. Você ganha 3 dias com todas as funcionalidades, incluindo IA e WhatsApp." },
            { n: "2", title: "Cadastre seus fornecedores", desc: "Adicione um por um ou importe sua planilha via CSV. Capacidade, tipo de carvão, documentação — tudo organizado." },
            { n: "3", title: "Registre interações e cargas", desc: "A cada ligação ou WhatsApp, registre o que foi combinado. Cargas prometidas viram alertas automáticos." },
            { n: "4", title: "Nunca mais perca uma entrega", desc: "O feed de ações do dia mostra exatamente o que você precisa fazer. Retornar ligações, confirmar cargas, renovar documentos." },
          ].map((s, i) => (
            <Reveal key={s.n} delay={i * 0.1}>
              <div className={`flex gap-8 py-8 ${i < 3 ? "border-b border-[#E5E7EB]" : ""}`}>
                <div className="shrink-0 w-12 h-12 bg-[#1B4332] text-white rounded-[14px] flex items-center justify-center text-[20px] font-extrabold">
                  {s.n}
                </div>
                <div>
                  <h3 className="text-[18px] font-bold text-[#111] mb-1.5">{s.title}</h3>
                  <p className="text-[15px] text-[#6B7280] leading-relaxed">{s.desc}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section id="precos" className="py-24 px-6 bg-[#F9FAFB]">
        <div className="max-w-[1100px] mx-auto text-center">
          <Reveal>
            <p className="text-[13px] font-bold text-[#1B4332] uppercase tracking-[0.08em] mb-3">Preços</p>
            <h2 className="text-[32px] font-extrabold tracking-[-0.02em] leading-[1.2] mb-4">Simples e transparente</h2>
            <p className="text-[16px] text-[#6B7280] max-w-[600px] mx-auto mb-4 leading-relaxed">
              Teste grátis por 3 dias com tudo liberado. Se gostar, assine. Se não gostar, continue usando o plano gratuito.
            </p>
            <div className="bg-[#E8F5E9] border border-[#D8F3DC] rounded-xl px-6 py-4 max-w-[700px] mx-auto mb-12 text-[15px] text-[#1B4332] font-semibold leading-relaxed">
              💡 Comece com 3 dias grátis no plano Professional completo. Depois, escolha o plano que faz sentido pra você.
            </div>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-6 max-w-[1000px] mx-auto text-left">
            {/* Starter */}
            <Reveal delay={0}>
              <div className="bg-white border border-[#E5E7EB] rounded-[20px] p-8 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] transition-all duration-300 h-full">
                <p className="text-[16px] font-bold text-[#6B7280] mb-2">Starter</p>
                <p className="text-[42px] font-extrabold text-[#111] tracking-[-0.03em] leading-none">R$ 197</p>
                <p className="text-[14px] text-[#9CA3AF] font-medium mt-1 mb-6">/mês por organização</p>
                <ul className="flex flex-col gap-3 mb-7">
                  {["Até 50 fornecedores", "Até 2 usuários", "Registro de interações", "Alertas e follow-ups", "Feed de ações do dia"].map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-[14px] text-[#374151] font-medium">
                      <span className="text-[#40916C] font-bold">✓</span>{item}
                    </li>
                  ))}
                  {["Sem integração WhatsApp", "Sem IA"].map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-[14px] text-[#9CA3AF] font-medium">
                      <span>–</span>{item}
                    </li>
                  ))}
                </ul>
                <Link href="/registro" className="block w-full py-3 rounded-[10px] text-center text-[14px] font-bold border border-[#1B4332] text-[#1B4332] hover:bg-[#E8F5E9] transition-all duration-200 active:scale-[0.97]">
                  Começar com Starter
                </Link>
              </div>
            </Reveal>

            {/* Professional */}
            <Reveal delay={0.1}>
              <div className="bg-white border-2 border-[#1B4332] rounded-[20px] p-8 shadow-[0_8px_32px_rgba(27,67,50,0.12)] relative h-full hover:shadow-[0_12px_40px_rgba(27,67,50,0.18)] transition-all duration-300">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#1B4332] text-white text-[12px] font-bold px-4 py-1 rounded-full">
                  Recomendado
                </div>
                <p className="text-[16px] font-bold text-[#6B7280] mb-2">Professional</p>
                <p className="text-[42px] font-extrabold text-[#111] tracking-[-0.03em] leading-none">R$ 497</p>
                <p className="text-[14px] text-[#9CA3AF] font-medium mt-1 mb-6">/mês por organização</p>
                <ul className="flex flex-col gap-3 mb-7">
                  {[
                    { text: "Até 200 fornecedores" },
                    { text: "Até 5 usuários" },
                    { text: "Tudo do Starter" },
                    { text: "Integração WhatsApp", bold: true },
                    { text: "IA extrai dados automaticamente", bold: true },
                    { text: "Confirmação de carga em 1 clique" },
                    { text: "Dashboard de compras" },
                  ].map((item) => (
                    <li key={item.text} className="flex items-start gap-2.5 text-[14px] text-[#374151] font-medium">
                      <span className="text-[#40916C] font-bold">✓</span>
                      {item.bold ? <strong>{item.text}</strong> : item.text}
                    </li>
                  ))}
                </ul>
                <Link href="/registro" className="block w-full py-3 rounded-[10px] text-center text-[14px] font-bold bg-[#1B4332] text-white hover:bg-[#2D6A4F] transition-all duration-200 active:scale-[0.97]">
                  Testar grátis por 3 dias →
                </Link>
              </div>
            </Reveal>

            {/* Enterprise */}
            <Reveal delay={0.2}>
              <div className="bg-white border border-[#E5E7EB] rounded-[20px] p-8 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] transition-all duration-300 h-full">
                <p className="text-[16px] font-bold text-[#6B7280] mb-2">Enterprise</p>
                <p className="text-[32px] font-extrabold text-[#111] tracking-[-0.03em] leading-none">Sob consulta</p>
                <p className="text-[14px] text-[#9CA3AF] font-medium mt-1 mb-6">contrato personalizado</p>
                <ul className="flex flex-col gap-3 mb-7">
                  {["Fornecedores ilimitados", "Usuários ilimitados", "Tudo do Professional", "Envio de mensagens pelo sistema", "Suporte dedicado", "Relatórios personalizados"].map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-[14px] text-[#374151] font-medium">
                      <span className="text-[#40916C] font-bold">✓</span>{item}
                    </li>
                  ))}
                </ul>
                <a href="mailto:contato@carvaoconnect.com.br" className="block w-full py-3 rounded-[10px] text-center text-[14px] font-bold border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F9FAFB] transition-all duration-200 active:scale-[0.97]">
                  Falar com vendas
                </a>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* CTA */}
      <Reveal>
        <section className="py-24 px-6 bg-[#1B4332] text-center">
          <div className="max-w-[600px] mx-auto">
            <h2 className="text-[36px] font-extrabold text-white tracking-[-0.02em] leading-[1.2] mb-4">
              Cada carga conta. Tenha controle de todas elas.
            </h2>
            <p className="text-[16px] text-white/60 mb-8 leading-relaxed">
              Comece a usar agora com 3 dias grátis. Se não gostar, continue usando o plano gratuito.
            </p>
            <Link href="/registro" className="inline-flex items-center gap-2 bg-white text-[#1B4332] px-8 py-3.5 rounded-xl text-[16px] font-bold hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.2)] transition-all duration-200 active:scale-[0.97]">
              Começar grátis agora →
            </Link>
            <p className="mt-4 text-[13px] text-white/40">Funciona no navegador. Sem instalação. Cancele quando quiser.</p>
          </div>
        </section>
      </Reveal>

      {/* FOOTER */}
      <footer className="py-12 px-6 border-t border-[#E5E7EB] bg-white">
        <div className="max-w-[1200px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-[13px] text-[#9CA3AF]">© 2026 Carvão Connect. Sete Lagoas, MG.</p>
          <div className="flex gap-6">
            <a href="#" className="text-[13px] text-[#6B7280] font-medium hover:text-[#111] transition-colors">Termos</a>
            <a href="#" className="text-[13px] text-[#6B7280] font-medium hover:text-[#111] transition-colors">Privacidade</a>
            <a href="mailto:contato@carvaoconnect.com.br" className="text-[13px] text-[#6B7280] font-medium hover:text-[#111] transition-colors">Contato</a>
          </div>
        </div>
      </footer>

      {/* CSS Animation */}
      <style jsx global>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}
