import { auth } from "@/lib/auth"
import { NextRequest } from "next/server"
import { sendMail } from "@/lib/mail"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.email) return new Response("Unauthorized", { status: 401 })

  const { searchParams } = new URL(req.url)

  if (searchParams.get("send") === "1") {
    const result = await sendMail({
      to: session.user.email,
      subject: "QAgrotis — Teste de e-mail",
      html: "<p>Se você recebeu este e-mail, o envio está funcionando corretamente!</p>",
    })
    return Response.json(result)
  }

  return Response.json({
    EMAIL_FROM: process.env.EMAIL_FROM?.trim() ?? "❌ não configurado",
    RESEND_API_KEY: process.env.RESEND_API_KEY ? "✅ configurado" : "❌ não configurado",
    SMTP_HOST: process.env.SMTP_HOST ?? "❌ não configurado",
    SMTP_USER: process.env.SMTP_USER ?? "❌ não configurado",
    SMTP_PASS: process.env.SMTP_PASS ? "✅ configurado" : "❌ não configurado",
  })
}
// force 1776399624
