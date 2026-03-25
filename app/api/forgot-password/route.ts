import { NextResponse } from "next/server"
import { PROTOTYPE_USERS } from "@/lib/prototype-users"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
const FROM = process.env.EMAIL_FROM ?? "noreply@qagrotis.com.br"

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

  const password = PROTOTYPE_USERS[email]
  if (!password) {
    // Return success even for unknown emails (security best practice)
    return NextResponse.json({ ok: true })
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    // Development fallback — print to terminal
    console.log(`\n[forgot-password] E-mail: ${email} | Senha: ${password}\n`)
    return NextResponse.json({ ok: true })
  }

  // Lazy instantiation — only when key is available
  const { Resend } = await import("resend")
  const resend = new Resend(apiKey)

  const { error } = await resend.emails.send({
    from: `QAgrotis <${FROM}>`,
    to: email,
    subject: "Suas credenciais de acesso — QAgrotis",
    html: buildEmailHtml(email, password),
  })

  if (error) {
    console.error("[forgot-password] Resend error:", JSON.stringify(error))
    return NextResponse.json(
      { error: `Resend: ${(error as { message?: string }).message ?? JSON.stringify(error)}` },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true })
}

function buildEmailHtml(email: string, password: string): string {
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

          <!-- Header -->
          <tr>
            <td style="padding:32px 40px 24px;text-align:center;">
              <p style="margin:0 0 4px;font-size:22px;font-weight:700;color:#333333;letter-spacing:-0.3px;">QAgrotis</p>
              <p style="margin:0;font-size:13px;color:#6b7280;">Gestão de Qualidade de Software</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:0 40px 24px;">
              <p style="margin:0 0 16px;font-size:15px;color:#333333;line-height:1.6;">
                Olá! Seguem suas credenciais de acesso ao QAgrotis:
              </p>

              <!-- Credentials box -->
              <table width="100%" cellpadding="0" cellspacing="0"
                style="background:#f4f5f9;border-radius:10px;margin-bottom:24px;">
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
                    <a href="${APP_URL}/login"
                      style="display:inline-block;padding:14px 32px;background:#5c7cfa;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:10px;">
                      Acessar minha conta
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
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
