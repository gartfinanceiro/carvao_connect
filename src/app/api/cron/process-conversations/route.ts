import { NextResponse } from "next/server"

export async function GET(req: Request) {
  // Validate Vercel Cron secret
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/process-conversations`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
      }
    )

    const result = await response.json()
    return NextResponse.json(result)
  } catch (err) {
    console.error("Cron process-conversations error:", err)
    return NextResponse.json(
      { error: "Failed to invoke edge function" },
      { status: 502 }
    )
  }
}
