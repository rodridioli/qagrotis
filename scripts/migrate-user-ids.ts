/**
 * migrate-user-ids.ts
 *
 * Renomeia IDs de CreatedUser que não seguem o padrão U-NNN para o padrão correto.
 * Exemplo: T-AQA → U-003, T-AUX → U-004, etc.
 *
 * Execução (uma única vez):
 *   npx tsx scripts/migrate-user-ids.ts
 *
 * O script é idempotente: ignora IDs que já seguem o padrão U-NNN.
 */

import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { readFileSync } from "fs"
import { resolve } from "path"

// ── Carregar .env manualmente (igual aos outros scripts) ──────────────────────
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function nextUId(existingIds: string[]): () => string {
  let max = 0
  for (const id of existingIds) {
    if (!id.startsWith("U-")) continue
    const n = parseInt(id.slice(2), 10)
    if (!isNaN(n) && n > max) max = n
  }
  return () => {
    max += 1
    return `U-${String(max).padStart(3, "0")}`
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL
  if (!connectionString || connectionString.includes("USER:PASSWORD")) {
    console.error("❌ DATABASE_URL ou DIRECT_URL não configurado. Defina a variável antes de executar.")
    process.exit(1)
  }
  console.log(`🔌 Conectando em: ${connectionString.replace(/:\/\/[^@]+@/, "://<credenciais>@")}`)
  const adapter = new PrismaPg({ connectionString })
  const prisma = new PrismaClient({ adapter })

  try {
    // 1. Buscar todos os CreatedUser
    const allUsers = await prisma.createdUser.findMany({ select: { id: true, name: true, email: true } })

    // 2. Separar os que precisam de migração (não seguem U-NNN)
    const toMigrate = allUsers.filter((u) => !/^U-\d+$/.test(u.id))

    if (toMigrate.length === 0) {
      console.log("✅ Nenhum ID fora do padrão encontrado. Nada a fazer.")
      return
    }

    // 3. Gerar mapa oldId → newId
    const allIds = allUsers.map((u) => u.id)
    const nextId = nextUId(allIds)
    const idMap = new Map<string, string>()
    for (const u of toMigrate) {
      idMap.set(u.id, nextId())
    }

    console.log("📋 Mapa de migração:")
    for (const [oldId, newId] of idMap.entries()) {
      const user = allUsers.find((u) => u.id === oldId)
      console.log(`  ${oldId} → ${newId}  (${user?.name ?? user?.email ?? ""})`)
    }

    // 4. Executar tudo em uma única transação com constraints deferidas
    //    para evitar violação de FK durante a atualização do PK.
    await prisma.$transaction(async (tx) => {
      // Deferir checagem de FK para o final da transação
      await tx.$executeRaw`SET CONSTRAINTS ALL DEFERRED`

      for (const [oldId, newId] of idMap.entries()) {
        // ── Tabelas com FK explícita para CreatedUser.id ──────────────────
        await tx.$executeRawUnsafe(
          `UPDATE "Notification" SET "userId" = $1 WHERE "userId" = $2`,
          newId, oldId,
        )
        await tx.$executeRawUnsafe(
          `UPDATE "UserBadge" SET "userId" = $1 WHERE "userId" = $2`,
          newId, oldId,
        )

        // ── Tabelas com referência lógica (sem FK no schema) ──────────────
        await tx.$executeRawUnsafe(
          `UPDATE "UserProfile" SET "userId" = $1 WHERE "userId" = $2`,
          newId, oldId,
        )
        await tx.$executeRawUnsafe(
          `UPDATE "InactiveUser" SET "userId" = $1 WHERE "userId" = $2`,
          newId, oldId,
        )
        await tx.$executeRawUnsafe(
          `UPDATE "InviteToken" SET "userId" = $1 WHERE "userId" = $2`,
          newId, oldId,
        )
        await tx.$executeRawUnsafe(
          `UPDATE "UserJiraCredentials" SET "userId" = $1 WHERE "userId" = $2`,
          newId, oldId,
        )
        await tx.$executeRawUnsafe(
          `UPDATE "ClockworkIntegration" SET "updatedByUserId" = $1 WHERE "updatedByUserId" = $2`,
          newId, oldId,
        )

        // Individual
        await tx.$executeRawUnsafe(
          `UPDATE "IndividualFerias" SET "evaluatedUserId" = $1 WHERE "evaluatedUserId" = $2`,
          newId, oldId,
        )
        await tx.$executeRawUnsafe(
          `UPDATE "IndividualFerias" SET "createdByUserId" = $1 WHERE "createdByUserId" = $2`,
          newId, oldId,
        )
        await tx.$executeRawUnsafe(
          `UPDATE "IndividualAusencias" SET "evaluatedUserId" = $1 WHERE "evaluatedUserId" = $2`,
          newId, oldId,
        )
        await tx.$executeRawUnsafe(
          `UPDATE "IndividualAusencias" SET "createdByUserId" = $1 WHERE "createdByUserId" = $2`,
          newId, oldId,
        )
        await tx.$executeRawUnsafe(
          `UPDATE "IndividualAusencias" SET "aprovadoPorId" = $1 WHERE "aprovadoPorId" = $2`,
          newId, oldId,
        )
        await tx.$executeRawUnsafe(
          `UPDATE "IndividualFeedback" SET "evaluatedUserId" = $1 WHERE "evaluatedUserId" = $2`,
          newId, oldId,
        )
        await tx.$executeRawUnsafe(
          `UPDATE "IndividualFeedback" SET "evaluatorUserId" = $1 WHERE "evaluatorUserId" = $2`,
          newId, oldId,
        )
        await tx.$executeRawUnsafe(
          `UPDATE "IndividualPerformanceEvaluation" SET "evaluatedUserId" = $1 WHERE "evaluatedUserId" = $2`,
          newId, oldId,
        )
        await tx.$executeRawUnsafe(
          `UPDATE "IndividualPerformanceEvaluation" SET "evaluatorUserId" = $1 WHERE "evaluatorUserId" = $2`,
          newId, oldId,
        )
        await tx.$executeRawUnsafe(
          `UPDATE "IndividualProgressao" SET "evaluatedUserId" = $1 WHERE "evaluatedUserId" = $2`,
          newId, oldId,
        )
        await tx.$executeRawUnsafe(
          `UPDATE "IndividualProgressao" SET "createdByUserId" = $1 WHERE "createdByUserId" = $2`,
          newId, oldId,
        )

        // Equipe
        await tx.$executeRawUnsafe(
          `UPDATE "EquipeChapterAuthor" SET "userId" = $1 WHERE "userId" = $2`,
          newId, oldId,
        )
        await tx.$executeRawUnsafe(
          `UPDATE "EquipeChapterRating" SET "userId" = $1 WHERE "userId" = $2`,
          newId, oldId,
        )

        // ── Por último: atualizar o PK em CreatedUser ─────────────────────
        await tx.$executeRawUnsafe(
          `UPDATE "CreatedUser" SET "id" = $1 WHERE "id" = $2`,
          newId, oldId,
        )

        console.log(`  ✓ ${oldId} → ${newId}`)
      }
    })

    console.log("\n✅ Migração concluída com sucesso!")
    console.log(`   ${idMap.size} usuário(s) renomeado(s).`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error("❌ Erro na migração:", err)
  process.exit(1)
})
