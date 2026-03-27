import { Resend } from "resend"
import { env } from "@/lib/env"

export const resend = new Resend(env.RESEND_API_KEY)

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string
  subject: string
  html: string
}) {
  const { data, error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to,
    subject,
    html,
  })

  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[email] Failed to send:", error)
    } else {
      console.error("[email] Failed to send email")
    }
    throw new Error("Failed to send email")
  }

  return data
}

export async function sendInviteEmail({
  to,
  name,
  token,
}: {
  to: string
  name: string
  token: string
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  const link = `${appUrl}/definir-senha/${token}`

  return sendEmail({
    to,
    subject: "Bem-vindo ao QAgrotis — defina sua senha",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
        <h2 style="margin:0 0 8px;font-size:20px;color:#111">Olá, ${name}!</h2>
        <p style="margin:0 0 24px;font-size:15px;color:#444">
          Sua conta no <strong>QAgrotis</strong> foi criada. Clique no botão abaixo para definir sua senha e acessar o sistema.
        </p>
        <a href="${link}" style="display:inline-block;padding:12px 24px;background:#16a34a;color:#fff;border-radius:6px;text-decoration:none;font-size:15px;font-weight:600">
          Definir senha
        </a>
        <p style="margin:24px 0 0;font-size:13px;color:#888">
          Este link expira em 24 horas. Se você não solicitou este acesso, ignore este e-mail.
        </p>
      </div>
    `,
  })
}
