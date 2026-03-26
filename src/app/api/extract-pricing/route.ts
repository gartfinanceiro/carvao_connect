import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import OpenAI from "openai"

const SYSTEM_PROMPT = `Você é um assistente especializado em extrair dados estruturados de tabelas de preço de carvão vegetal siderúrgico.

Analise a imagem/documento enviado e extraia TODAS as informações em formato JSON, seguindo EXATAMENTE esta estrutura:

{
  "density_pricing_rules": [
    {
      "person_type": "pf" ou "pj",
      "min_density": número (kg/MDC),
      "max_density": número (kg/MDC),
      "price_per_mdc": número (R$)
    }
  ],
  "moisture_rules": [
    {
      "from": número (%),
      "to": número (%),
      "type": "none" ou "excess" ou "total"
    }
  ],
  "impurity_rules": {
    "tolerance_percent": número,
    "discount_on": "gross" ou "net"
  },
  "additional_rules": {
    "metering_tolerance_percent": número ou null,
    "payment_method": string ou null,
    "payment_deadline": string ou null,
    "species_required": string ou null,
    "third_party_payment_rule": string ou null,
    "notes": string ou null
  },
  "effective_date": "YYYY-MM-DD" ou null,
  "confidence": "high" ou "medium" ou "low"
}

Regras de interpretação:
- "P. Física" ou "Pessoa Física" = person_type "pf"
- "P. Jurídica" ou "Pessoa Jurídica" = person_type "pj"
- "Abaixo de X kg" = min_density: 0, max_density: X-0.01
- "De X a Y kg" = min_density: X, max_density: Y
- "Acima de X kg" = min_density: X, max_density: 99999
- Faixas como "< 200", "200-220", "> 220" devem virar min/max numéricos
- "Desconto excedente no peso" ou "desconta excedente" = type "excess"
- "Desconto total de umidade" ou "desconta toda umidade" = type "total"
- "Tolerância" ou "sem desconto" ou "isento" = type "none"
- "Desconta no peso bruto" = discount_on "gross"
- "Desconta no peso líquido" = discount_on "net"
- Se a tabela mencionar data de vigência, extrair em effective_date no formato YYYY-MM-DD
- Se não conseguir extrair algum campo, usar null
- Se a confiança na extração for baixa (documento ilegível, formato incomum), setar confidence como "low"
- Se houver campos que você não tem certeza, setar confidence como "medium"

Responda APENAS com o JSON, sem markdown, sem explicações.`

export async function POST(request: Request) {
  try {
    // 1. Check OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY não configurada.", code: "NO_API_KEY" },
        { status: 500 }
      )
    }

    // 2. Auth
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 })
    }

    // 3. Get org_id
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id, role")
      .eq("id", user.id)
      .single()

    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Apenas administradores." }, { status: 403 })
    }

    // 4. Get file_path from body
    const body = await request.json()
    const { file_path } = body as { file_path: string }

    if (!file_path) {
      return NextResponse.json({ error: "file_path é obrigatório." }, { status: 400 })
    }

    // 5. Validate file_path belongs to this org
    if (!file_path.startsWith(profile.organization_id)) {
      return NextResponse.json({ error: "Acesso negado ao arquivo." }, { status: 403 })
    }

    // 6. Get signed URL and fetch file
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from("pricing-documents")
      .createSignedUrl(file_path, 120)

    if (signedUrlError || !signedUrlData?.signedUrl) {
      return NextResponse.json({ error: "Erro ao acessar arquivo." }, { status: 500 })
    }

    const fileResponse = await fetch(signedUrlData.signedUrl)
    if (!fileResponse.ok) {
      return NextResponse.json({ error: "Erro ao baixar arquivo." }, { status: 500 })
    }

    const arrayBuffer = await fileResponse.arrayBuffer()
    const base64Content = Buffer.from(arrayBuffer).toString("base64")

    // Determine mime type from file extension
    const ext = file_path.split(".").pop()?.toLowerCase()
    let mimeType = "application/pdf"
    if (ext === "jpg" || ext === "jpeg") mimeType = "image/jpeg"
    else if (ext === "png") mimeType = "image/png"

    // 7. Call OpenAI Vision API
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 4000,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64Content}`,
                detail: "high",
              },
            },
            {
              type: "text",
              text: "Extraia os dados desta tabela de preços de carvão vegetal.",
            },
          ],
        },
      ],
    })

    const content = completion.choices[0]?.message?.content
    if (!content) {
      return NextResponse.json(
        { error: "A IA não retornou dados. Tente com outro documento." },
        { status: 422 }
      )
    }

    // 8. Parse response
    let parsed: Record<string, unknown>
    try {
      const cleaned = content.replace(/```json|```/g, "").trim()
      parsed = JSON.parse(cleaned)
    } catch {
      console.error("[extract-pricing] Failed to parse OpenAI response:", content)
      return NextResponse.json(
        { error: "Não foi possível interpretar a tabela. Tente com uma imagem mais nítida." },
        { status: 422 }
      )
    }

    return NextResponse.json({
      success: true,
      data: parsed,
      source_document_url: file_path,
    })
  } catch (err) {
    console.error("[extract-pricing] Error:", err)

    // OpenAI specific errors
    if (err instanceof OpenAI.APIError) {
      if (err.status === 429) {
        return NextResponse.json(
          { error: "Limite de requisições da IA excedido. Tente novamente em alguns minutos." },
          { status: 429 }
        )
      }
      return NextResponse.json(
        { error: "Erro no serviço de IA. Tente novamente." },
        { status: 502 }
      )
    }

    return NextResponse.json(
      { error: "Erro interno do servidor." },
      { status: 500 }
    )
  }
}
