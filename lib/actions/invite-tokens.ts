"use server"

import { promises as fs } from "fs"
import path from "path"
import { randomBytes } from "crypto"
import { z } from "zod"

const DATA_DIR = path.join(process.cwd(), "data")
const TOKENS_FILE = path.join(DATA_DIR, "invite-tokens.json")
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

interface InviteToken {
  token: string
  userId: string
  email: string
  expiresAt: number
  used: boolean
}

async function readTokens(): Promise<InviteToken[]> {
  try {
    const content = await fs.readFile(TOKENS_FILE, "utf-8")
    return JSON.parse(content) as InviteToken[]
  } catch {
    return []
  }
}

async function writeTokens(tokens: InviteToken[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true })
  await fs.writeFile(TOKENS_FILE, JSON.stringify(tokens, null, 2), "utf-8")
}

export async function gerarConvite(userId: string, email: string): Promise<string> {
  const token = randomBytes(32).toString("hex")
  const tokens = await readTokens()
  tokens.push({
    token,
    userId,
    email: email.toLowerCase(),
    expiresAt: Date.now() + TOKEN_TTL_MS,
    used: false,
  })
  await writeTokens(tokens)
  return token
}

export async function verificarToken(
  token: string
): Promise<{ valid: true; userId: string; email: string } | { valid: false; reason: string }> {
  const sanitized = z.string().regex(/^[a-f0-9]{64}$/).safeParse(token)
  if (!sanitized.success) return { valid: false, reason: "Token inválido." }

  const tokens = await readTokens()
  const record = tokens.find((t) => t.token === token)
  if (!record) return { valid: false, reason: "Token não encontrado." }
  if (record.used) return { valid: false, reason: "Este link já foi utilizado." }
  if (Date.now() > record.expiresAt) return { valid: false, reason: "Link expirado. Solicite um novo convite." }

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

  const CREATED_FILE = path.join(DATA_DIR, "created-users.json")
  let users: Array<{ id: string; email: string; password: string; [key: string]: unknown }> = []
  try {
    const content = await fs.readFile(CREATED_FILE, "utf-8")
    users = JSON.parse(content)
  } catch {
    return { ok: false, reason: "Usuário não encontrado." }
  }

  const userIndex = users.findIndex((u) => u.id === check.userId)
  if (userIndex === -1) return { ok: false, reason: "Usuário não encontrado." }

  users[userIndex].password = parsed.data
  await fs.writeFile(CREATED_FILE, JSON.stringify(users, null, 2), "utf-8")

  // Mark token as used
  const tokens = await readTokens()
  const tokenIndex = tokens.findIndex((t) => t.token === token)
  if (tokenIndex !== -1) {
    tokens[tokenIndex].used = true
    await writeTokens(tokens)
  }

  return { ok: true }
}
