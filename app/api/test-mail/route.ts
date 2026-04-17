import { NextRequest } from "next/server"
import nodemailer from "nodemailer"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const to = searchParams.get("to") || "rodridioli@gmail.com"

  const smtpHost = process.env.SMTP_HOST?.trim()
  const smtpUser = process.env.SMTP_USER?.trim()
  const smtpPass = process.env.SMTP_PASS?.trim()
  const smtpPort = parseInt(process.env.SMTP_PORT || "587")

  // Show config
  if (searchParams.get("send") !== "1") {
    return Response.json({
      SMTP_HOST: smtpHost ?? "❌ não configurado",
      SMTP_PORT: smtpPort,
      SMTP_USER: smtpUser ?? "❌ não configurado",
      SMTP_PASS: smtpPass ? "✅ configurado" : "❌ não configurado",
    })
  }

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

    // Verify connection first
    await transporter.verify()

    const info = await transporter.sendMail({
      from: smtpUser,
      to,
      subject: "QAgrotis — Teste SMTP",
      html: "<p>Teste de envio SMTP funcionando!</p>",
    })

    return Response.json({ success: true, messageId: info.messageId, to })
  } catch (err) {
    return Response.json({ 
      success: false, 
      error: err instanceof Error ? err.message : String(err),
      code: (err as NodeJS.ErrnoException).code ?? null
    })
  }
}
