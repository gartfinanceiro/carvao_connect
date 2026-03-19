import { NextResponse } from "next/server"
import { stripe } from "@/lib/stripe"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(request: Request) {
  try {
    const { sessionId } = (await request.json()) as { sessionId: string }

    if (!sessionId) {
      return NextResponse.json({ error: "Session ID ausente." }, { status: 400 })
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    })

    if (session.status !== "complete") {
      return NextResponse.json({ error: "Sessão não concluída." }, { status: 400 })
    }

    const userId = session.metadata?.user_id
    const orgId = session.metadata?.organization_id

    if (!userId || !orgId) {
      return NextResponse.json({ error: "Dados da sessão inválidos." }, { status: 400 })
    }

    // Generate a magic link to auto-login the user
    const supabase = createAdminClient()
    const { data: linkData, error: linkError } =
      await supabase.auth.admin.generateLink({
        type: "magiclink",
        email: session.customer_details?.email || "",
      })

    if (linkError || !linkData) {
      return NextResponse.json({ error: "Erro ao gerar link de login." }, { status: 500 })
    }

    // Extract the token from the generated link
    const url = new URL(linkData.properties.action_link)
    const token = url.searchParams.get("token")
    const type = url.searchParams.get("type")

    return NextResponse.json({
      success: true,
      orgId,
      userId,
      // Return the token hash for client-side auto-login
      tokenHash: linkData.properties.hashed_token,
      token,
      type,
      email: session.customer_details?.email,
    })
  } catch (err) {
    console.error("[verify-checkout] Error:", err)
    return NextResponse.json(
      { error: "Erro ao verificar checkout." },
      { status: 500 }
    )
  }
}
