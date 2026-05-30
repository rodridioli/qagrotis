/**
 * cleanup-orphan-records.ts
 *
 * Remove registros vinculados a usuários que não existem mais no banco.
 * Útil para sanear dados anteriores à implementação da exclusão em cascata.
 *
 * Regras:
 *   - Registros cujo userId primário (evaluatedUserId, userId, etc.) não
 *     corresponde a nenhum CreatedUser são considerados órfãos e removidos.
 *   - Cenário: apenas desvincula o autor (createdBy = null) — não deleta.
 *   - A execução é atômica — em caso de falha, nenhum dado é apagado.
 *   - Por padrão opera em DRY_RUN (apenas conta, não deleta).
 *
 * Uso:
 *   npx tsx scripts/cleanup-orphan-records.ts             # dry-run
 *   DRY_RUN=false npx tsx scripts/cleanup-orphan-records.ts  # executa
 */

import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { readFileSync } from "fs"
import { resolve } from "path"

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

const DRY_RUN = process.env.DRY_RUN !== "false"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter, log: ["error"] })

type CountFn = (args: { where: unknown }) => Promise<number>
type DeleteFn = (args: { where: unknown }) => Promise<{ count: number }>
type UpdateFn = (args: { where: unknown; data: unknown }) => Promise<{ count: number }>

async function main() {
  console.log(`\n🔍 Modo: ${DRY_RUN ? "DRY RUN (nenhum dado será apagado)" : "EXECUÇÃO REAL"}`)
  console.log("   Coletando IDs de usuários válidos…\n")

  const validUsers = await prisma.createdUser.findMany({ select: { id: true } })
  const validIds = validUsers.map((u) => u.id)

  if (validIds.length === 0) {
    console.log("⚠️  Nenhum usuário encontrado em CreatedUser. Abortando por segurança.")
    return
  }

  console.log(`   ${validIds.length} usuário(s) válido(s) encontrado(s).\n`)

  // ── Contagem prévia ──────────────────────────────────────────────────────
  const notIn = { notIn: validIds }

  const [
    kanbanTimerSessions,
    kanbanInApprovalTrackers,
    kanbanUserCardStates,
    kanbanAssignments,
    jiraWorklogCaches,
    jiraWorklogSyncMarkers,
    jiraAccountIdCaches,
    chapterRedemptions,
    chapterRatings,
    chapterAuthors,
    ausencias,
    ferias,
    progressoes,
    feedbacks,
    avaliacoes,
    dominios,
    inviteTokens,
    jiraCredentials,
    cenarios,
  ] = await Promise.all([
    (prisma.kanbanTimerSession.count as CountFn)({ where: { userId: notIn } }),
    (prisma.kanbanInApprovalTracker.count as CountFn)({ where: { userId: notIn } }),
    (prisma.kanbanUserCardState.count as CountFn)({ where: { userId: notIn } }),
    (prisma.kanbanAssignment.count as CountFn)({ where: { userId: notIn } }),
    prisma.jiraWorklogCache.count({ where: { userId: notIn } }),
    prisma.jiraWorklogSyncMarker.count({ where: { userId: notIn } }),
    prisma.jiraAccountIdCache.count({ where: { userId: notIn } }),
    prisma.chapterRedemption.count({ where: { userId: notIn } }),
    (prisma.equipeChapterRating.count as CountFn)({ where: { userId: notIn } }),
    (prisma.equipeChapterAuthor.count as CountFn)({ where: { userId: notIn } }),
    (prisma.individualAusencias.count as CountFn)({ where: { evaluatedUserId: notIn } }),
    (prisma.individualFerias.count as CountFn)({ where: { evaluatedUserId: notIn } }),
    (prisma.individualProgressao.count as CountFn)({ where: { evaluatedUserId: notIn } }),
    (prisma.individualFeedback.count as CountFn)({ where: { evaluatedUserId: notIn } }),
    (prisma.individualPerformanceEvaluation.count as CountFn)({ where: { evaluatedUserId: notIn } }),
    (prisma.dominioAvaliacao.count as CountFn)({ where: { evaluatedUserId: notIn } }),
    prisma.inviteToken.count({ where: { userId: notIn } }),
    prisma.userJiraCredentials.count({ where: { userId: notIn } }),
    prisma.cenario.count({ where: { createdBy: notIn } }),
  ])

  const total =
    kanbanTimerSessions + kanbanInApprovalTrackers + kanbanUserCardStates +
    kanbanAssignments + jiraWorklogCaches + jiraWorklogSyncMarkers +
    jiraAccountIdCaches + chapterRedemptions + chapterRatings + chapterAuthors +
    ausencias + ferias + progressoes + feedbacks + avaliacoes + dominios +
    inviteTokens + jiraCredentials + cenarios

  console.log("📊 Registros órfãos encontrados:")
  console.log(`   kanbanTimerSessions:      ${kanbanTimerSessions}`)
  console.log(`   kanbanInApprovalTrackers: ${kanbanInApprovalTrackers}`)
  console.log(`   kanbanUserCardStates:     ${kanbanUserCardStates}`)
  console.log(`   kanbanAssignments:        ${kanbanAssignments}`)
  console.log(`   jiraWorklogCaches:        ${jiraWorklogCaches}`)
  console.log(`   jiraWorklogSyncMarkers:   ${jiraWorklogSyncMarkers}`)
  console.log(`   jiraAccountIdCaches:      ${jiraAccountIdCaches}`)
  console.log(`   chapterRedemptions:       ${chapterRedemptions}`)
  console.log(`   chapterRatings:           ${chapterRatings}`)
  console.log(`   chapterAuthors:           ${chapterAuthors}`)
  console.log(`   ausencias:                ${ausencias}`)
  console.log(`   ferias:                   ${ferias}`)
  console.log(`   progressoes:              ${progressoes}`)
  console.log(`   feedbacks:                ${feedbacks}`)
  console.log(`   avaliacoes:               ${avaliacoes}`)
  console.log(`   dominios:                 ${dominios}`)
  console.log(`   inviteTokens:             ${inviteTokens}`)
  console.log(`   jiraCredentials:          ${jiraCredentials}`)
  console.log(`   cenarios (desvinculados): ${cenarios}`)
  console.log(`   ─────────────────────────────────────`)
  console.log(`   Total:                    ${total}`)

  if (total === 0) {
    console.log("\n✅ Nenhum registro órfão encontrado. Nada a remover.")
    return
  }

  if (DRY_RUN) {
    console.log("\n🛑 DRY RUN ativo — nenhum dado foi alterado.")
    console.log("   Para executar: DRY_RUN=false npx tsx scripts/cleanup-orphan-records.ts\n")
    return
  }

  console.log("\n🗑️  Executando limpeza em transação única…")

  await prisma.$transaction(async (tx) => {
    await (tx.kanbanTimerSession.deleteMany as DeleteFn)({ where: { userId: notIn } })
    await (tx.kanbanInApprovalTracker.deleteMany as DeleteFn)({ where: { userId: notIn } })
    await (tx.kanbanUserCardState.deleteMany as DeleteFn)({ where: { userId: notIn } })
    await (tx.kanbanAssignment.deleteMany as DeleteFn)({ where: { userId: notIn } })
    await tx.jiraWorklogCache.deleteMany({ where: { userId: notIn } })
    await tx.jiraWorklogSyncMarker.deleteMany({ where: { userId: notIn } })
    await tx.jiraAccountIdCache.deleteMany({ where: { userId: notIn } })
    await tx.chapterRedemption.deleteMany({ where: { userId: notIn } })
    await (tx.equipeChapterRating.deleteMany as DeleteFn)({ where: { userId: notIn } })
    await (tx.equipeChapterAuthor.deleteMany as DeleteFn)({ where: { userId: notIn } })
    await (tx.individualAusencias.deleteMany as DeleteFn)({ where: { evaluatedUserId: notIn } })
    await (tx.individualFerias.deleteMany as DeleteFn)({ where: { evaluatedUserId: notIn } })
    await (tx.individualProgressao.deleteMany as DeleteFn)({ where: { evaluatedUserId: notIn } })
    await (tx.individualFeedback.deleteMany as DeleteFn)({ where: { evaluatedUserId: notIn } })
    await (tx.individualPerformanceEvaluation.deleteMany as DeleteFn)({ where: { evaluatedUserId: notIn } })
    await (tx.dominioAvaliacao.deleteMany as DeleteFn)({ where: { evaluatedUserId: notIn } })
    await tx.inviteToken.deleteMany({ where: { userId: notIn } })
    await tx.userJiraCredentials.deleteMany({ where: { userId: notIn } })
    await (tx.cenario.updateMany as UpdateFn)({ where: { createdBy: notIn }, data: { createdBy: null } })
  })

  console.log("\n✅ Limpeza concluída com sucesso!")
  console.log(`   ${total} registro(s) afetado(s) (${cenarios} cenário(s) desvinculado(s), restantes removidos)\n`)
}

main()
  .catch((err) => {
    console.error("\n❌ Erro durante a limpeza:", err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
