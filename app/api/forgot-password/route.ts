
import { NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { sendMail } from "@/lib/mail"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

// Rate limit: max 5 requests per IP per 15 minutes
const ipRateMap = new Map<string, { count: number; resetAt: number }>()
function checkIpRateLimit(ip: string): boolean {
  const now = Date.now()
  // Cleanup expired entries to prevent memory leak
  for (const [k, v] of ipRateMap) { if (now > v.resetAt) ipRateMap.delete(k) }
  const entry = ipRateMap.get(ip)
  if (!entry || now > entry.resetAt) {
    ipRateMap.set(ip, { count: 1, resetAt: now + 15 * 60_000 })
    return true
  }
  if (entry.count >= 5) return false
  entry.count++
  return true
}

export async function POST(request: Request) {
  const ip = (request.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim()
  if (!checkIpRateLimit(ip)) {
    return NextResponse.json({ error: "Muitas tentativas. Aguarde 15 minutos." }, { status: 429 })
  }
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

  // All users use token-based reset (never send passwords in plain text)
  // Case: created user — generate reset link
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

    const token = randomBytes(32).toString("hex")
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 1) // 1 hour

    await prisma.inviteToken.create({
      data: {
        token,
        userId: user.id,
        email: user.email,
        expiresAt,
        used: false,
      },
    })

    const resetUrl = `${APP_URL}/definir-senha/${token}`
    const { success, error: sendError } = await sendMail({
      to: email,
      subject: "Recuperação de Acesso - QAgrotis",
      html: buildResetHtml(email, resetUrl)
    })
    
    if (!success) {
      return NextResponse.json({ error: sendError }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[forgot-password] DB error:", err)
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 })
  }
}

function buildResetHtml(email: string, resetUrl: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: sans-serif; color: #333; }
    .container { padding: 20px; border: 1px solid #eee; border-radius: 8px; max-width: 600px; }
    .button { background: #008a5d; color: white !important; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <h2>Recuperação de Acesso</h2>
    <p>Olá,</p>
    <p>Recebemos uma solicitação para redefinir a senha da sua conta <strong>${email}</strong> no QAgrotis.</p>
    <p>Clique no botão abaixo para criar uma nova senha:</p>
    <p style="margin: 30px 0;">
      <a href="${resetUrl}" class="button">Redefinir minha senha</a>
    </p>
    <p>Se você não solicitou isso, pode ignorar este e-mail.</p>
    <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;" />
    <p style="font-size: 12px; color: #888;">&copy; ${new Date().getFullYear()} QAgrotis — Gestão de Qualidade</p>
  </div>
</body>
</html>`
}

function buildCredentialsHtml(email: string, password: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: sans-serif; color: #333; }
    .container { padding: 20px; border: 1px solid #eee; border-radius: 8px; max-width: 600px; }
    .box { background: #f9f9f9; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #008a5d; }
  </style>
</head>
<body>
  <div class="container">
    <h2>Acesso ao QAgrotis</h2>
    <p>Olá,</p>
    <p>Aqui estão as suas credenciais de acesso solicitadas para a conta <strong>${email}</strong>:</p>
    <div class="box">
      <strong>Senha atual:</strong> <code>${password}</code>
    </div>
    <p>Recomendamos que você altere sua senha após o primeiro acesso.</p>
    <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;" />
    <p style="font-size: 12px; color: #888;">&copy; ${new Date().getFullYear()} QAgrotis — Gestão de Qualidade</p>
  </div>
</body>
</html>`
}
