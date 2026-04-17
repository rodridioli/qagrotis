import { auth } from "@/lib/auth"
import { NextRequest } from "next/server"
import { sendMail } from "@/lib/mail"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.email) return new Response("Unauthorized", { status: 401 })

  const EMAIL_FROM = process.env.EMAIL_FROM
  const RESEND_API_KEY = process.env.RESEND_API_KEY
  const SMTP_HOST = process.env.SMTP_HOST

  const diagnostics = {
    EMAIL_FROM: EMAIL_FROM || "❌ não configurado",
    RESEND_API_KEY: RESEND_API_KEY ? `✅ configurado (${RESEND_API_KEY.slice(0, 6)}...)` : "❌ não configurado",
    SMTP_HOST: SMTP_HOST || "não configurado",
    isResendReady: !!(RESEND_API_KEY && EMAIL_FROM && !EMAIL_FROM.includes("resend.dev")),
    isSandboxMode: !!(RESEND_API_KEY && EMAIL_FROM?.includes("resend.dev")),
  }

  const { searchParams } = new URL(req.url)
  if (searchParams.get("send") === "1") {
    const result = await sendMail({
      to: session.user.email,
      subject: "QAgrotis — Teste de envio",
      html: "<p>Resend configurado corretamente! Domínio: <strong>" + (EMAIL_FROM ?? "?") + "</strong></p>",
    })
    return Response.json({ diagnostics, sendTest: result })
  }

  return Response.json(diagnostics)
}
