import { Resend } from "resend"
import { env } from "@/lib/env"

// ── Resend client (lazy — only used if RESEND_API_KEY is set) ──────────────────

function getResend(): Resend | null {
  const key = env.RESEND_API_KEY
  if (!key) return null
  return new Resend(key)
}

// ── SMTP via Nodemailer (optional — activated by SMTP_HOST env var) ────────────

async function sendViaSMTP({
  to,
  subject,
  html,
}: {
  to: string
  subject: string
  html: string
}): Promise<void> {
  const host = process.env.SMTP_HOST
  const port = parseInt(process.env.SMTP_PORT ?? "587", 10)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  const from = process.env.SMTP_FROM ?? env.EMAIL_FROM ?? user

  if (!host || !user || !pass) {
    throw new Error("SMTP not configured")
  }

  // Dynamically import so the module is not bundled when unused
  const nodemailer = await import("nodemailer")
  const transporter = nodemailer.default.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  })

  await transporter.sendMail({ from, to, subject, html })
}

// ── Core send (tries Resend first, falls back to SMTP) ────────────────────────

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string
  subject: string
  html: string
}): Promise<void> {
  // 1. Try SMTP first if configured
  const smtpConfigured = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
  if (smtpConfigured) {
    await sendViaSMTP({ to, subject, html })
    return
  }

  // 2. Fall back to Resend
  const resend = getResend()
  if (!resend) throw new Error("No email provider configured.")

  const from = env.EMAIL_FROM || "onboarding@resend.dev"
  const { error } = await resend.emails.send({ from, to, subject, html })

  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[email] Resend error:", error)
    } else {
      console.error("[email] Failed to send email via Resend")
    }
    throw new Error("Failed to send email")
  }
}

// ── Welcome email template (password set at creation) ─────────────────────────

export async function sendWelcomeEmail({
  to,
  name,
  password,
}: {
  to: string
  name: string
  password: string
}): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000"
  const escapedPassword = password.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

  await sendEmail({
    to,
    subject: "Bem-vindo ao QAgrotis — sua senha de acesso",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
        <h2 style="margin:0 0 8px;font-size:20px;color:#111">Olá, ${name}!</h2>
        <p style="margin:0 0 24px;font-size:15px;color:#444">
          Sua conta no <strong>QAgrotis</strong> foi criada. Utilize as credenciais abaixo para acessar o sistema.
        </p>
        <div style="background:#f5f5f5;border-radius:8px;padding:16px 20px;margin-bottom:24px">
          <p style="margin:0 0 8px;font-size:14px;color:#555"><strong>E-mail:</strong> ${to}</p>
          <p style="margin:0;font-size:14px;color:#555"><strong>Senha:</strong> <span style="font-family:monospace;letter-spacing:1px">${escapedPassword}</span></p>
        </div>
        <a href="${appUrl}" style="display:inline-block;padding:12px 24px;background:#00735D;color:#fff;border-radius:6px;text-decoration:none;font-size:15px;font-weight:600">
          Acessar o sistema
        </a>
        <p style="margin:24px 0 0;font-size:13px;color:#888">
          Por segurança, altere sua senha após o primeiro acesso em <strong>Configurações → Usuários → Editar perfil</strong>.
        </p>
      </div>
    `,
  })
}

// ── Invite email template ──────────────────────────────────────────────────────

export async function sendInviteEmail({
  to,
  name,
  token,
}: {
  to: string
  name: string
  token: string
}): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000"
  const link = `${appUrl}/definir-senha/${token}`

  await sendEmail({
    to,
    subject: "Bem-vindo ao QAgrotis — defina sua senha",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
        <h2 style="margin:0 0 8px;font-size:20px;color:#111">Olá, ${name}!</h2>
        <p style="margin:0 0 24px;font-size:15px;color:#444">
          Sua conta no <strong>QAgrotis</strong> foi criada. Clique no botão abaixo para definir sua senha e acessar o sistema.
        </p>
        <a href="${link}" style="display:inline-block;padding:12px 24px;background:#00735D;color:#fff;border-radius:6px;text-decoration:none;font-size:15px;font-weight:600">
          Definir senha
        </a>
        <p style="margin:24px 0 8px;font-size:13px;color:#888">
          Se o botão não funcionar, copie e cole este link no navegador:
        </p>
        <p style="font-size:12px;color:#555;word-break:break-all">${link}</p>
        <p style="margin:16px 0 0;font-size:12px;color:#aaa">
          Este link expira em 24 horas. Se você não solicitou este acesso, ignore este e-mail.
        </p>
      </div>
    `,
  })
}
