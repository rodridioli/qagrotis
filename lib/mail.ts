
import { Resend } from "resend"
import nodemailer from "nodemailer"

const SMTP_CONFIG = {
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
}

export interface MailOptions {
  to: string
  subject: string
  html: string
}

/**
 * Envia email tentando Resend primeiro, e SMTP como fallback secundário.
 */
export async function sendMail({ to, subject, html }: MailOptions): Promise<{ success: boolean; error?: string }> {
  console.log(`[mail] Tentativa de envio para: ${to}`)
  
  const RESEND_API_KEY = process.env.RESEND_API_KEY
  const FROM = process.env.EMAIL_FROM || "onboarding@resend.dev"
  
  // 1. Tentar via Resend se a chave existir
  if (RESEND_API_KEY) {
    try {
      const resend = new Resend(RESEND_API_KEY)
      const { data, error } = await resend.emails.send({
        from: FROM, 
        to,
        subject,
        html,
      })

      if (error) {
        console.error("[mail] Erro Resend:", JSON.stringify(error))
      } else {
        console.log("[mail] Enviado via Resend com sucesso ID:", data?.id)
        return { success: true }
      }
    } catch (err) {
      console.error("[mail] Erro inesperado no Resend:", err)
    }
  }

  // 2. Tentar via SMTP se configurado
  if (SMTP_CONFIG.host && SMTP_CONFIG.auth.user) {
    console.log("[mail] Tentando fallback via SMTP...")
    try {
      const transporter = nodemailer.createTransport(SMTP_CONFIG)
      const info = await transporter.sendMail({
        from: FROM,
        to,
        subject,
        html,
      })
      console.log("[mail] Enviado via SMTP com sucesso ID:", info.messageId)
      return { success: true }
    } catch (err) {
      console.error("[mail] Erro no fallback SMTP:", err)
      return { success: false, error: err instanceof Error ? err.message : "Erro no servidor de SMTP" }
    }
  }

  const noConfigMsg = "Nenhum serviço de e-mail (Resend ou SMTP) configurado ou funcional."
  return { success: false, error: noConfigMsg }
}
