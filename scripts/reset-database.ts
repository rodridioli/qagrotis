/**
 * Reset completo do banco de dados.
 * Apaga TODOS os registros e recria apenas os usuários de teste especificados.
 *
 * Uso: npx tsx scripts/reset-database.ts
 */

import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { pbkdf2Sync, randomBytes } from "crypto"
import { readFileSync } from "fs"
import { resolve } from "path"

// Carrega .env manualmente
try {
  const lines = readFileSync(resolve(process.cwd(), ".env"), "utf-8").split("\n")
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "")
    if (key && !(key in process.env)) process.env[key] = val
  }
} catch { /* ignore */ }

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter, log: ["error"] })

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex")
  const hash = pbkdf2Sync(password, salt, 100_000, 64, "sha512").toString("hex")
  return `pbkdf2:100000:${salt}:${hash}`
}

type UserType = "Padrão" | "Administrador"
type AccessProfile = "QA" | "UX" | "TW" | "MGR"

const USERS: { id: string; name: string; email: string; type: UserType; accessProfile: AccessProfile }[] = [
  { id: "U-AMG", name: "Admin MGR",   email: "admin.mgr@local.dev",  type: "Administrador", accessProfile: "MGR" },
  { id: "U-AQA", name: "Admin QA",    email: "admin.qa@local.dev",   type: "Administrador", accessProfile: "QA"  },
  { id: "U-PQA", name: "Padrão QA",   email: "padrao.qa@local.dev",  type: "Padrão",        accessProfile: "QA"  },
  { id: "U-AUX", name: "Admin UX",    email: "admin.ux@local.dev",   type: "Administrador", accessProfile: "UX"  },
  { id: "U-PUX", name: "Padrão UX",   email: "padrao.ux@local.dev",  type: "Padrão",        accessProfile: "UX"  },
  { id: "U-ATW", name: "Admin TW",    email: "admin.tw@local.dev",   type: "Administrador", accessProfile: "TW"  },
  { id: "U-PTW", name: "Padrão TW",   email: "padrao.tw@local.dev",  type: "Padrão",        accessProfile: "TW"  },
]

const PASSWORD = "Test#1234"

async function main() {
  console.log("=== RESET DO BANCO DE DADOS ===\n")

  // ── 1. Apagar tudo na ordem correta (FK dependencies) ──────────────────────

  // Dependentes de CreatedUser
  await prisma.notification.deleteMany()
  await prisma.userBadge.deleteMany()
  console.log("✓ Notifications e UserBadges removidos")

  // Chapters
  await prisma.equipeChapterRating.deleteMany()
  await prisma.equipeChapterAuthor.deleteMany()
  await prisma.equipeChapter.deleteMany()
  console.log("✓ Chapters removidos")

  // Avaliações individuais
  await prisma.individualPerformanceEvaluation.deleteMany()
  await prisma.individualFeedback.deleteMany()
  await prisma.individualProgressao.deleteMany()
  console.log("✓ Avaliações individuais removidas")

  // Tokens e perfis
  await prisma.inviteToken.deleteMany()
  await prisma.inactiveUser.deleteMany()
  await prisma.userProfile.deleteMany()
  await prisma.userJiraCredentials.deleteMany()
  console.log("✓ Tokens, perfis e credenciais Jira removidos")

  // Cenários e suítes (null FKs primeiro para evitar conflito com Credencial)
  await prisma.cenario.updateMany({ data: { credencialId: null, systemId: null, moduleId: null } })
  await prisma.suite.updateMany({ data: { sistemaId: null, moduloId: null } })
  await prisma.cenario.deleteMany()
  await prisma.suite.deleteMany()
  console.log("✓ Cenários e suítes removidos")

  // Credenciais, módulos, sistemas, clientes, integrações
  await prisma.credencial.deleteMany()
  await prisma.modulo.deleteMany()
  await prisma.sistema.deleteMany()
  await prisma.cliente.deleteMany()
  await prisma.integracao.deleteMany()
  console.log("✓ Credenciais, módulos, sistemas, clientes e integrações removidos")

  // Usuários criados e legacy
  await prisma.createdUser.deleteMany()
  await prisma.qaUser.deleteMany()
  console.log("✓ CreatedUsers e QaUsers removidos")

  // Auth.js (Account e Session têm onDelete: Cascade via User)
  await prisma.session.deleteMany()
  await prisma.account.deleteMany()
  await prisma.user.deleteMany()
  await prisma.verificationToken.deleteMany()
  console.log("✓ Usuários OAuth e sessões removidos")

  console.log("\n=== BANCO LIMPO — criando usuários ===\n")

  // ── 2. Criar os 7 usuários de teste ────────────────────────────────────────
  const password = hashPassword(PASSWORD)

  for (const u of USERS) {
    await prisma.createdUser.create({
      data: {
        id:            u.id,
        name:          u.name,
        email:         u.email,
        type:          u.type,
        accessProfile: u.accessProfile,
        password,
      },
    })
    console.log(`✔  ${u.email.padEnd(26)} ${u.type.padEnd(15)} ${u.accessProfile}`)
  }

  console.log(`\nSenha de todos: ${PASSWORD}`)
  console.log("\n=== RESET CONCLUÍDO ===")
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
