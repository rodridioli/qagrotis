import { auth } from "@/lib/auth"
import { NextRequest } from "next/server"
import nodemailer from "nodemailer"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.email) return new Response("Unauthorized", { status: 401 })

  const { searchParams } = new URL(req.url)
  const smtpHost = process.env.SMTP_HOST?.trim()
  const smtpUser = process.env.SMTP_USER?.trim()
  const smtpPass = process.env.SMTP_PASS?.trim()
  const smtpPort = parseInt(process.env.SMTP_PORT || "587")

  if (searchParams.get("send") === "1") {
    if (!smtpHost || !smtpUser || !smtpPass) {
      return Response.json({ error: "SMTP não configurado", smtpHost, smtpUser, smtpPass: !!smtpPass })
    }
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: { user: smtpUser, pass: smtpPass },
      })
      await transporter.verify()
      const info = await transporter.sendMail({
        from: smtpUser,
        to: session.user.email,
        subject: "QAgrotis — Teste SMTP",
        html: "<p>E-mail enviado com sucesso via Gmail SMTP!</p>",
      })
      return Response.json({ success: true, messageId: info.messageId, to: session.user.email })
    } catch (err) {
      return Response.json({ success: false, error: err instanceof Error ? err.message : String(err) })
    }
  }

  return Response.json({
    SMTP_HOST: smtpHost ?? "❌ não configurado",
    SMTP_PORT: smtpPort,
    SMTP_USER: smtpUser ?? "❌ não configurado",
    SMTP_PASS: smtpPass ? "✅ configurado" : "❌ não configurado",
    loggedInAs: session.user.email,
  })
}
