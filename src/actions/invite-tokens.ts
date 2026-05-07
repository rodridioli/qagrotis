"use server"

import { randomBytes } from "crypto"
import { z } from "zod"
import { hashPassword, verifyPassword } from "@/lib/db-utils"
import { prisma } from "@/lib/prisma"

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

export async function gerarConvite(userId: string, email: string): Promise<string> {
  const token = randomBytes(32).toString("hex")
  const now = new Date()
  const expiresAt = new Date(now.getTime() + TOKEN_TTL_MS)

  // Prune expired/used tokens to prevent unbounded growth, then create new one
  await prisma.$transaction([
    prisma.inviteToken.deleteMany({ where: { OR: [{ used: true }, { expiresAt: { lte: now } }] } }),
    prisma.inviteToken.create({
      data: { token, userId, email: email.toLowerCase(), expiresAt, used: false },
    }),
  ])

  return token
}

export async function verificarToken(
  token: string
): Promise<{ valid: true; userId: string; email: string } | { valid: false; reason: string }> {
  const sanitized = z.string().regex(/^[a-f0-9]{64}$/).safeParse(token)
  if (!sanitized.success) return { valid: false, reason: "Token inválido." }

  const record = await prisma.inviteToken.findUnique({ where: { token } })
  if (!record) return { valid: false, reason: "Token não encontrado." }
  if (record.used) return { valid: false, reason: "Este link já foi utilizado." }
  if (new Date() > record.expiresAt) return { valid: false, reason: "Link expirado. Solicite um novo convite." }

  return { valid: true, userId: record.userId, email: record.email }
}

export async function definirSenha(
  token: string,
  password: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const check = await verificarToken(token)
  if (!check.valid) return { ok: false, reason: check.reason }

  const parsed = z.string().min(6, "Senha mínima de 6 caracteres").max(128).safeParse(password)
  if (!parsed.success) return { ok: false, reason: parsed.error.issues[0].message }

  const user = await prisma.createdUser.findUnique({ where: { id: check.userId }, select: { id: true } })
  if (!user) return { ok: false, reason: "Usuário não encontrado." }

  // Hash password and mark token as used atomically
  await prisma.$transaction([
    prisma.createdUser.update({ where: { id: check.userId }, data: { password: hashPassword(parsed.data) } }),
    prisma.inviteToken.update({ where: { token }, data: { used: true } }),
  ])

  return { ok: true }
}

// Re-export for use in auth layer
export { verifyPassword }
