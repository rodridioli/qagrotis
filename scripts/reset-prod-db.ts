/**
 * reset-prod-db.ts
 *
 * Apaga TODOS os registros do banco (incluindo usuários e dados OAuth) e
 * recria apenas os 7 usuários de teste com senha Test#1234.
 *
 * ⚠️  OPERAÇÃO IRREVERSÍVEL — execute somente em ambiente controlado.
 *
 * Uso local (com DATABASE_URL da Vercel):
 *   DATABASE_URL="postgres://..." npx tsx scripts/reset-prod-db.ts
 *
 * Ou com .env local apontando para produção:
 *   npx tsx scripts/reset-prod-db.ts
 */

import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { pbkdf2Sync, randomBytes } from "crypto"
import { readFileSync } from "fs"
import { resolve } from "path"

// Carrega .env manualmente (mesmo padrão dos demais scripts)
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

const SEED_USERS: { id: string; name: string; email: string; type: UserType; accessProfile: AccessProfile }[] = [
  { id: "T-AMG", name: "Admin MGR",  email: "admin.mgr@local.dev",  type: "Administrador", accessProfile: "MGR" },
  { id: "T-AQA", name: "Admin QA",   email: "admin.qa@local.dev",   type: "Administrador", accessProfile: "QA"  },
  { id: "T-PQA", name: "Padrão QA",  email: "padrao.qa@local.dev",  type: "Padrão",        accessProfile: "QA"  },
  { id: "T-AUX", name: "Admin UX",   email: "admin.ux@local.dev",   type: "Administrador", accessProfile: "UX"  },
  { id: "T-PUX", name: "Padrão UX",  email: "padrao.ux@local.dev",  type: "Padrão",        accessProfile: "UX"  },
  { id: "T-ATW", name: "Admin TW",   email: "admin.tw@local.dev",   type: "Administrador", accessProfile: "TW"  },
  { id: "T-PTW", name: "Padrão TW",  email: "padrao.tw@local.dev",  type: "Padrão",        accessProfile: "TW"  },
]

const PASSWORD = "Test#1234"

async function main() {
  console.log("\n⚠️  RESET COMPLETO DO BANCO DE DADOS")
  console.log("=".repeat(50))
  console.log(`DATABASE_URL: ${(process.env.DATABASE_URL ?? "").replace(/:\/\/[^@]+@/, "://<credenciais>@")}`)
  console.log("=".repeat(50))

  // ── Contagem antes do reset ──────────────────────────────────────────────────
  const [
    createdUsers, userProfiles, notifications, userBadges,
    chapters, performances, feedbacks, progressoes,
    cenarios, suites, modulos, sistemas, clientes,
    credenciais, integracoes, oauthUsers,
  ] = await Promise.all([
    prisma.createdUser.count(),
    prisma.userProfile.count(),
    prisma.notification.count(),
    prisma.userBadge.count(),
    prisma.equipeChapter.count(),
    prisma.individualPerformanceEvaluation.count(),
    prisma.individualFeedback.count(),
    prisma.individualProgressao.count(),
    prisma.cenario.count(),
    prisma.suite.count(),
    prisma.modulo.count(),
    prisma.sistema.count(),
    prisma.cliente.count(),
    prisma.credencial.count(),
    prisma.integracao.count(),
    prisma.user.count(),
  ])

  console.log("\n📊 Registros que serão removidos:")
  console.log(`   CreatedUsers:    ${createdUsers}`)
  console.log(`   UserProfiles:    ${userProfiles}`)
  console.log(`   Notifications:   ${notifications}`)
  console.log(`   UserBadges:      ${userBadges}`)
  console.log(`   Chapters:        ${chapters}`)
  console.log(`   Avaliações:      ${performances}`)
  console.log(`   Feedbacks:       ${feedbacks}`)
  console.log(`   Progressões:     ${progressoes}`)
  console.log(`   Cenários:        ${cenarios}`)
  console.log(`   Suítes:          ${suites}`)
  console.log(`   Módulos:         ${modulos}`)
  console.log(`   Sistemas:        ${sistemas}`)
  console.log(`   Clientes:        ${clientes}`)
  console.log(`   Credenciais:     ${credenciais}`)
  console.log(`   Integrações:     ${integracoes}`)
  console.log(`   OAuth Users:     ${oauthUsers}`)

  console.log("\n🗑️  Executando reset em transação única…")

  // ── Deleção em ordem respeitando FK constraints ──────────────────────────────
  // Usamos transações interativas para garantir atomicidade com a ordem correta.
  await prisma.$transaction(async (tx) => {
    // 1. Dependentes de CreatedUser
    await tx.notification.deleteMany({})
    await tx.userBadge.deleteMany({})

    // 2. Chapters e seus filhos (cascade cuida de ratings/authors, mas explicitamos)
    await tx.equipeChapterRating.deleteMany({})
    await tx.equipeChapterAuthor.deleteMany({})
    await tx.equipeChapter.deleteMany({})

    // 3. Registros individuais (sem FK para tabelas de usuário)
    await tx.individualPerformanceEvaluation.deleteMany({})
    await tx.individualFeedback.deleteMany({})
    await tx.individualProgressao.deleteMany({})

    // 4. Tokens e perfis
    await tx.inviteToken.deleteMany({})
    await tx.inactiveUser.deleteMany({})
    await tx.userJiraCredentials.deleteMany({})
    await tx.userProfile.deleteMany({})

    // 5. Usuários manuais
    await tx.createdUser.deleteMany({})

    // 6. Conteúdo (Suite e Cenario antes de Modulo/Sistema/Credencial)
    await tx.suite.deleteMany({})
    await tx.cenario.deleteMany({})
    await tx.credencial.deleteMany({})
    await tx.modulo.deleteMany({})
    await tx.sistema.deleteMany({})
    await tx.cliente.deleteMany({})
    await tx.qaUser.deleteMany({})
    await tx.integracao.deleteMany({})

    // 7. Auth.js / OAuth (Account e Session cascadeiam de User)
    await tx.account.deleteMany({})
    await tx.session.deleteMany({})
    await tx.verificationToken.deleteMany({})
    await tx.user.deleteMany({})

    // 8. Recriar os 7 usuários de teste
    const password = hashPassword(PASSWORD)
    for (const u of SEED_USERS) {
      await tx.createdUser.create({
        data: {
          id:            u.id,
          name:          u.name,
          email:         u.email,
          type:          u.type,
          accessProfile: u.accessProfile,
          password,
        },
      })
      await tx.userProfile.create({
        data: {
          userId:        u.id,
          name:          u.name,
          email:         u.email,
          type:          u.type,
          accessProfile: u.accessProfile,
        },
      })
    }
  }, { timeout: 30_000 })

  console.log("\n✅ Reset concluído com sucesso!")
  console.log("\n👤 Usuários criados (senha: Test#1234):")
  for (const u of SEED_USERS) {
    console.log(`   ${u.email.padEnd(28)} | ${u.type.padEnd(14)} | ${u.accessProfile}`)
  }
}

main()
  .catch((err) => {
    console.error("\n❌ Erro durante o reset. Nenhum dado foi apagado (rollback automático).")
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
