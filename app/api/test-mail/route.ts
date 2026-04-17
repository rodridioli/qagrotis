import { auth } from "@/lib/auth"
import { NextRequest } from "next/server"
import { Resend } from "resend"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.email) return new Response("Unauthorized", { status: 401 })

  const EMAIL_FROM = process.env.EMAIL_FROM?.trim() ?? ""
  const RESEND_API_KEY = process.env.RESEND_API_KEY?.trim() ?? ""

  const { searchParams } = new URL(req.url)

  if (searchParams.get("send") === "1") {
    // Call Resend directly — bypass mail.ts to isolate the issue
    try {
      const resend = new Resend(RESEND_API_KEY)
      const result = await resend.emails.send({
        from: EMAIL_FROM,
        to: session.user.email!,
        subject: "QAgrotis — Teste direto Resend",
        html: "<p>Teste direto da API do Resend. Se recebeu, está funcionando!</p>",
      })
      return Response.json({
        from: EMAIL_FROM,
        to: session.user.email,
        resendData: result.data,
        resendError: result.error,
        success: !result.error,
      })
    } catch (err) {
      return Response.json({
        from: EMAIL_FROM,
        to: session.user.email,
        exception: err instanceof Error ? err.message : String(err),
        success: false,
      })
    }
  }

  return Response.json({
    EMAIL_FROM,
    EMAIL_FROM_length: EMAIL_FROM.length,
    EMAIL_FROM_chars: [...EMAIL_FROM].map(c => c.charCodeAt(0)),
    RESEND_API_KEY_prefix: RESEND_API_KEY.slice(0, 8),
    RESEND_API_KEY_length: RESEND_API_KEY.length,
  })
}
