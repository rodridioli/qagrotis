import { NextResponse } from "next/server"
import { PROTOTYPE_USERS } from "@/lib/prototype-users"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
const FROM = process.env.EMAIL_FROM ?? "noreply@qagrotis.com.br"

async function sendWithResend(to: string, subject: string, html: string): Promise<string | null> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn(`\n[forgot-password] RESEND_API_KEY não configurada — e-mail NÃO enviado para: ${to}\n`)
    return "Serviço de e-mail não configurado. Contate o administrador."
  }
  try {
    const { Resend } = await import("resend")
    const resend = new Resend(apiKey)
    const { error } = await resend.emails.send({ from: `QAgrotis <${FROM}>`, to, subject, html })
    if (error) {
      console.error("[forgot-password] Resend error:", JSON.stringify(error))
      return (error as { message?: string }).message ?? "Erro ao enviar e-mail."
    }
    return null
  } catch (err) {
    console.error("[forgot-password] Unexpected error sending email:", err)
    return "Erro inesperado ao enviar e-mail. Tente novamente."
  }
}

export async function POST(request: Request) {
  let email: string | undefined

  try {
    const body = await request.json()
    email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : undefined
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 })
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "E-mail inválido." }, { status: 400 })
  }

  // Case 1: prototype credential user — send credentials directly
  const prototypePassword = PROTOTYPE_USERS[email]
  if (prototypePassword) {
    const sendError = await sendWithResend(
      email,
      "Suas credenciais de acesso — QAgrotis",
      buildCredentialsHtml(email, prototypePassword)
    )
    if (sendError) {
      return NextResponse.json({ error: sendError }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  }

  // Case 2: created user — generate reset link
  try {
    const { prisma } = await import("@/lib/prisma")
    const user = await prisma.createdUser.findFirst({
      where: { email: email.toLowerCase() },
      select: { id: true, email: true },
    })

    if (!user) {
      // Security: don't reveal whether email exists
      return NextResponse.json({ ok: true })
    }

    const { randomBytes } = await import("crypto")
    const token = randomBytes(32).toString("hex")
    const now = new Date()
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000)

    await prisma.$transaction([
      prisma.inviteToken.deleteMany({ where: { OR: [{ used: true }, { expiresAt: { lte: now } }] } }),
      prisma.inviteToken.create({
        data: { token, userId: user.id, email: user.email, expiresAt, used: false },
      }),
    ])

    const resetUrl = `${APP_URL}/definir-senha/${token}`
    const sendError = await sendWithResend(
      email,
      "Redefinição de senha — QAgrotis",
      buildResetHtml(email, resetUrl)
    )
    if (sendError) {
      return NextResponse.json({ error: sendError }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[forgot-password] DB error:", err)
    return NextResponse.json({ error: "Erro interno. Tente novamente." }, { status: 500 })
  }
}

function buildCredentialsHtml(email: string, password: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Credenciais de acesso — QAgrotis</title>
</head>
<body style="margin:0;padding:0;background:#f4f5f9;font-family:Roboto,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <tr>
            <td style="padding:32px 40px 24px;text-align:center;">
              <p style="margin:0 0 4px;font-size:22px;font-weight:700;color:#333333;letter-spacing:-0.3px;">QAgrotis</p>
              <p style="margin:0;font-size:13px;color:#6b7280;">Gestão de Qualidade de Software</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 24px;">
              <p style="margin:0 0 16px;font-size:15px;color:#333333;line-height:1.6;">
                Olá! Seguem suas credenciais de acesso ao QAgrotis:
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f9;border-radius:10px;margin-bottom:24px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 8px;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">E-mail</p>
                    <p style="margin:0 0 16px;font-size:15px;font-weight:600;color:#333333;">${email}</p>
                    <p style="margin:0 0 8px;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Senha</p>
                    <p style="margin:0;font-size:15px;font-weight:600;color:#333333;">${password}</p>
                  </td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${APP_URL}/login" style="display:inline-block;padding:14px 32px;background:#5c7cfa;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:10px;">
                      Acessar minha conta
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;line-height:1.6;">
                Se você não solicitou este e-mail, ignore-o.<br/>
                © ${new Date().getFullYear()} QAgrotis. Todos os direitos reservados.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function buildResetHtml(email: string, resetUrl: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Redefinição de senha — QAgrotis</title>
</head>
<body style="margin:0;padding:0;background:#f4f5f9;font-family:Roboto,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <tr>
            <td style="padding:32px 40px 24px;text-align:center;">
              <p style="margin:0 0 4px;font-size:22px;font-weight:700;color:#333333;letter-spacing:-0.3px;">QAgrotis</p>
              <p style="margin:0;font-size:13px;color:#6b7280;">Gestão de Qualidade de Software</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 24px;">
              <p style="margin:0 0 16px;font-size:15px;color:#333333;line-height:1.6;">
                Olá! Recebemos uma solicitação para redefinir a senha da conta <strong>${email}</strong>.
              </p>
              <p style="margin:0 0 24px;font-size:15px;color:#333333;line-height:1.6;">
                Clique no botão abaixo para criar uma nova senha. O link é válido por <strong>24 horas</strong>.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${resetUrl}" style="display:inline-block;padding:14px 32px;background:#5c7cfa;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:10px;">
                      Redefinir senha
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;font-size:13px;color:#6b7280;text-align:center;line-height:1.6;">
                Se você não solicitou a redefinição, ignore este e-mail. Sua senha permanece a mesma.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;line-height:1.6;">
                © ${new Date().getFullYear()} QAgrotis. Todos os direitos reservados.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
