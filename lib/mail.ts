
import { Resend } from "resend"
import nodemailer from "nodemailer"

export interface MailOptions {
  to: string
  subject: string
  html: string
}

/**
 * Envia email via Resend (com domínio verificado) ou SMTP como fallback.
 *
 * RESEND — para enviar para qualquer endereço:
 *   1. Acesse https://resend.com/domains e adicione seu domínio (ex: agrotis.com.br)
 *   2. Configure os registros DNS (MX, SPF, DKIM) fornecidos pelo Resend
 *   3. Defina EMAIL_FROM=noreply@seudominio.com.br no Vercel
 *   4. Defina RESEND_API_KEY com sua chave de produção
 *
 * Enquanto não tiver domínio verificado, use SMTP como fallback (Gmail, SendGrid etc.)
 */
export async function sendMail({ to, subject, html }: MailOptions): Promise<{ success: boolean; error?: string }> {
  const RESEND_API_KEY = process.env.RESEND_API_KEY
  const FROM = process.env.EMAIL_FROM

  // ── Resend ──────────────────────────────────────────────────────────────────
  if (RESEND_API_KEY && FROM && !FROM.includes("resend.dev")) {
    try {
      const resend = new Resend(RESEND_API_KEY)
      const { data, error } = await resend.emails.send({ from: FROM, to, subject, html })
      if (error) {
        // Resend retorna 403 quando o domínio não está verificado ou em sandbox
        console.error("[mail] Resend error:", JSON.stringify(error))
        // Não retorna aqui — cai para o fallback SMTP
      } else {
        return { success: true }
      }
    } catch (err) {
      console.error("[mail] Resend exception:", err)
    }
  } else if (RESEND_API_KEY && (!FROM || FROM.includes("resend.dev"))) {
    // Aviso explícito: domínio sandbox restringe destinatários
    console.warn("[mail] Resend em modo sandbox (resend.dev). Configure EMAIL_FROM com seu domínio verificado para enviar a qualquer endereço.")
  }

  // ── SMTP (fallback) ─────────────────────────────────────────────────────────
  const smtpHost = process.env.SMTP_HOST
  const smtpUser = process.env.SMTP_USER
  const smtpPass = process.env.SMTP_PASS
  const smtpFrom = FROM || smtpUser

  if (smtpHost && smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(process.env.SMTP_PORT || "587"),
        secure: process.env.SMTP_SECURE === "true",
        auth: { user: smtpUser, pass: smtpPass },
      })
      await transporter.sendMail({ from: smtpFrom, to, subject, html })
      return { success: true }
    } catch (err) {
      console.error("[mail] SMTP error:", err)
      return { success: false, error: err instanceof Error ? err.message : "Erro no servidor SMTP" }
    }
  }

  return {
    success: false,
    error: "Serviço de e-mail não configurado. Configure RESEND_API_KEY + EMAIL_FROM (domínio verificado) ou SMTP_HOST + SMTP_USER + SMTP_PASS.",
  }
}
