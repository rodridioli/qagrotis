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

/** Executa fn e retorna 0 se a tabela não existir (P2021). */
async function safeCount(fn: () => Promise<number>): Promise<number> {
  try { return await fn() } catch (e: unknown) {
    if (typeof e === "object" && e !== null && "code" in e && (e as { code: string }).code === "P2021") return 0
    throw e
  }
}
async function safeDelete(fn: () => Promise<{ count: number }>): Promise<{ count: number }> {
  try { return await fn() } catch (e: unknown) {
    if (typeof e === "object" && e !== null && "code" in e && (e as { code: string }).code === "P2021") return { count: 0 }
    throw e
  }
}

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
    safeCount(() => (prisma.kanbanTimerSession.count as unknown as CountFn)({ where: { userId: notIn } })),
    safeCount(() => (prisma.kanbanInApprovalTracker.count as unknown as CountFn)({ where: { userId: notIn } })),
    safeCount(() => (prisma.kanbanUserCardState.count as unknown as CountFn)({ where: { userId: notIn } })),
    safeCount(() => (prisma.kanbanAssignment.count as unknown as CountFn)({ where: { userId: notIn } })),
    safeCount(() => prisma.jiraWorklogCache.count({ where: { userId: notIn } })),
    safeCount(() => prisma.jiraWorklogSyncMarker.count({ where: { userId: notIn } })),
    safeCount(() => prisma.jiraAccountIdCache.count({ where: { userId: notIn } })),
    safeCount(() => prisma.chapterRedemption.count({ where: { userId: notIn } })),
    safeCount(() => (prisma.equipeChapterRating.count as unknown as CountFn)({ where: { userId: notIn } })),
    safeCount(() => (prisma.equipeChapterAuthor.count as unknown as CountFn)({ where: { userId: notIn } })),
    safeCount(() => (prisma.individualAusencias.count as unknown as CountFn)({ where: { evaluatedUserId: notIn } })),
    safeCount(() => (prisma.individualFerias.count as unknown as CountFn)({ where: { evaluatedUserId: notIn } })),
    safeCount(() => (prisma.individualProgressao.count as unknown as CountFn)({ where: { evaluatedUserId: notIn } })),
    safeCount(() => (prisma.individualFeedback.count as unknown as CountFn)({ where: { evaluatedUserId: notIn } })),
    safeCount(() => (prisma.individualPerformanceEvaluation.count as unknown as CountFn)({ where: { evaluatedUserId: notIn } })),
    safeCount(() => (prisma.dominioAvaliacao.count as unknown as CountFn)({ where: { evaluatedUserId: notIn } })),
    safeCount(() => prisma.inviteToken.count({ where: { userId: notIn } })),
    safeCount(() => prisma.userJiraCredentials.count({ where: { userId: notIn } })),
    safeCount(() => prisma.cenario.count({ where: { createdBy: notIn } })),
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
    await safeDelete(() => (tx.kanbanTimerSession.deleteMany as unknown as DeleteFn)({ where: { userId: notIn } }))
    await safeDelete(() => (tx.kanbanInApprovalTracker.deleteMany as unknown as DeleteFn)({ where: { userId: notIn } }))
    await safeDelete(() => (tx.kanbanUserCardState.deleteMany as unknown as DeleteFn)({ where: { userId: notIn } }))
    await safeDelete(() => (tx.kanbanAssignment.deleteMany as unknown as DeleteFn)({ where: { userId: notIn } }))
    await safeDelete(() => tx.jiraWorklogCache.deleteMany({ where: { userId: notIn } }))
    await safeDelete(() => tx.jiraWorklogSyncMarker.deleteMany({ where: { userId: notIn } }))
    await safeDelete(() => tx.jiraAccountIdCache.deleteMany({ where: { userId: notIn } }))
    await safeDelete(() => tx.chapterRedemption.deleteMany({ where: { userId: notIn } }))
    await safeDelete(() => (tx.equipeChapterRating.deleteMany as unknown as DeleteFn)({ where: { userId: notIn } }))
    await safeDelete(() => (tx.equipeChapterAuthor.deleteMany as unknown as DeleteFn)({ where: { userId: notIn } }))
    await safeDelete(() => (tx.individualAusencias.deleteMany as unknown as DeleteFn)({ where: { evaluatedUserId: notIn } }))
    await safeDelete(() => (tx.individualFerias.deleteMany as unknown as DeleteFn)({ where: { evaluatedUserId: notIn } }))
    await safeDelete(() => (tx.individualProgressao.deleteMany as unknown as DeleteFn)({ where: { evaluatedUserId: notIn } }))
    await safeDelete(() => (tx.individualFeedback.deleteMany as unknown as DeleteFn)({ where: { evaluatedUserId: notIn } }))
    await safeDelete(() => (tx.individualPerformanceEvaluation.deleteMany as unknown as DeleteFn)({ where: { evaluatedUserId: notIn } }))
    await safeDelete(() => (tx.dominioAvaliacao.deleteMany as unknown as DeleteFn)({ where: { evaluatedUserId: notIn } }))
    await safeDelete(() => tx.inviteToken.deleteMany({ where: { userId: notIn } }))
    await safeDelete(() => tx.userJiraCredentials.deleteMany({ where: { userId: notIn } }))
    await safeDelete(() => (tx.cenario.updateMany as unknown as UpdateFn)({ where: { createdBy: notIn }, data: { createdBy: null } }))
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
