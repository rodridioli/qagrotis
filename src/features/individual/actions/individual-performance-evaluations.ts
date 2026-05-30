"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { prisma } from "@/core/prisma"
import { createNotification } from "@/core/actions/notifications"
import { ensureIndividualPerformanceEvaluationTable } from "@/core/prisma-schema-ensure"
import { requireSession } from "@/core/session"
import { buildRole, can } from "@/core/rbac/policy"
import { getActiveQaUsers } from "@/features/usuarios/actions/usuarios"
import { getTeamMemberIds } from "@/features/equipe/actions/equipes"
import {
  computePerformanceScorePercent,
  DEFAULT_EVALUATION_PERIOD,
  isEvaluationPeriodSlug,
  parseSelectionsJson,
  PERFORMANCE_COMPETENCY_IDS,
  selectionsCompleteSchema,
} from "@/features/individual/lib/individual-performance-evaluation"

const userIdSchema = z.string().min(1).max(128)
const idSchema = z.string().min(1).max(128)

const periodoSchema = z.enum([
  "T1_TRIMESTRE",
  "T2_TRIMESTRE",
  "T3_TRIMESTRE",
  "T4_TRIMESTRE",
  "S1_SEMESTRE",
  "S2_SEMESTRE",
])

export type IndividualPerformanceEvaluationStatusDto = "RASCUNHO" | "CONCLUIDA"

export interface IndividualPerformanceEvaluationListRow {
  id: string
  codigo: number
  /** ISO yyyy-mm-dd (data de atualização, exibida na lista). */
  dataYmd: string
  pontuacaoPercent: number | null
  status: IndividualPerformanceEvaluationStatusDto
  periodo: string
}

async function requirePerformanceAccess(): Promise<{
  session: NonNullable<Awaited<ReturnType<typeof requireSession>>>
  canViewAll: boolean
}> {
  const session = await requireSession()
  const role = buildRole(session.user.type, session.user.accessProfile)
  const canViewAll = can(role, "individual.viewOthers")
  const canViewTeam = can(role, "individual.viewTeam")
  if (!canViewAll && !canViewTeam) throw new Error("Não autorizado.")
  if (session.user.type !== "Administrador") throw new Error("Não autorizado.")
  return { session, canViewAll }
}

async function assertEvaluatedUserInScope(
  evaluatedUserId: string,
  callerId: string,
  canViewAll: boolean,
): Promise<void> {
  const r = userIdSchema.safeParse(evaluatedUserId)
  if (!r.success) throw new Error("Usuário inválido.")

  if (canViewAll) {
    const users = await getActiveQaUsers()
    const ok = users.some((u) => u.id === evaluatedUserId)
    if (!ok) throw new Error("Usuário não encontrado ou inativo.")
  } else {
    const memberIds = await getTeamMemberIds(callerId)
    if (!memberIds.includes(evaluatedUserId)) throw new Error("Não autorizado.")
  }
}

function ymdFromDate(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, "0")
  const day = String(d.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function evalPrismaMessage(e: unknown, fallback: string): string {
  const code = typeof e === "object" && e !== null && "code" in e ? String((e as { code: string }).code) : ""
  const msg = typeof e === "object" && e !== null && "message" in e ? String((e as { message: string }).message) : ""
  if (code === "P2021" || /does not exist|não existe|relation/i.test(msg)) {
    return "Tabela de avaliações ainda não existe. Recarregue a página ou rode as migrações Prisma."
  }
  return fallback
}

export async function listIndividualPerformanceEvaluations(
  evaluatedUserId: string,
): Promise<IndividualPerformanceEvaluationListRow[]> {
  try {
    const { session, canViewAll } = await requirePerformanceAccess()
    await assertEvaluatedUserInScope(evaluatedUserId, session.user.id, canViewAll)
    await ensureIndividualPerformanceEvaluationTable()

    const rows = (await prisma.individualPerformanceEvaluation.findMany({
      where: { evaluatedUserId },
      orderBy: [{ codigo: "desc" }],
      select: {
        id: true,
        codigo: true,
        updatedAt: true,
        pontuacaoPercent: true,
        status: true,
        periodo: true,
      },
    })) as {
      id: string
      codigo: number
      updatedAt: Date
      pontuacaoPercent: number | null
      status: string
      periodo: string | null
    }[]
    return rows.map((row) => ({
      id: row.id,
      codigo: row.codigo,
      dataYmd: ymdFromDate(row.updatedAt),
      pontuacaoPercent:
        row.pontuacaoPercent != null && !Number.isNaN(Number(row.pontuacaoPercent))
          ? Number(row.pontuacaoPercent)
          : null,
      status: row.status as IndividualPerformanceEvaluationStatusDto,
      periodo: row.periodo && isEvaluationPeriodSlug(row.periodo) ? row.periodo : DEFAULT_EVALUATION_PERIOD,
    }))
  } catch (e) {
    console.error("[listIndividualPerformanceEvaluations]", e)
    return []
  }
}

export interface IndividualPerformanceEvaluationDetail {
  id: string
  evaluatedUserId: string
  codigo: number
  status: IndividualPerformanceEvaluationStatusDto
  selections: Record<string, number>
  pontuacaoPercent: number | null
  periodo: string
  /** Data de atualização da avaliação (ISO yyyy-mm-dd), exibida como “Data da avaliação”. */
  dataYmd: string
}

export async function getIndividualPerformanceEvaluation(
  id: string,
): Promise<IndividualPerformanceEvaluationDetail | null> {
  try {
    const { session, canViewAll } = await requirePerformanceAccess()
    const r = idSchema.safeParse(id)
    if (!r.success) return null
    await ensureIndividualPerformanceEvaluationTable()

    const row = await prisma.individualPerformanceEvaluation.findUnique({
      where: { id },
    })
    if (!row) return null
    // IDOR: valida que o avaliado pertence ao scope do caller
    await assertEvaluatedUserInScope(row.evaluatedUserId, session.user.id, canViewAll)
    const p = (row as { periodo?: string | null }).periodo
    return {
      id: row.id,
      evaluatedUserId: row.evaluatedUserId,
      codigo: row.codigo,
      status: row.status as IndividualPerformanceEvaluationStatusDto,
      selections: parseSelectionsJson(row.selections),
      pontuacaoPercent:
        row.pontuacaoPercent != null && !Number.isNaN(Number(row.pontuacaoPercent))
          ? Number(row.pontuacaoPercent)
          : null,
      periodo: p && isEvaluationPeriodSlug(p) ? p : DEFAULT_EVALUATION_PERIOD,
      dataYmd: ymdFromDate(row.updatedAt),
    }
  } catch (e) {
    console.error("[getIndividualPerformanceEvaluation]", e)
    return null
  }
}

/** @deprecated Use createAndSaveIndividualPerformanceEvaluation instead. */
export async function createDraftIndividualPerformanceEvaluation(
  evaluatedUserId: string,
): Promise<{ id: string } | { error: string }> {
  try {
    const { session, canViewAll } = await requirePerformanceAccess()
    if (!canViewAll) return { error: "Criação de avaliações restrita a administradores MGR." }
    await assertEvaluatedUserInScope(evaluatedUserId, session.user.id, canViewAll)
    await ensureIndividualPerformanceEvaluationTable()

    const agg = await prisma.individualPerformanceEvaluation.aggregate({
      where: { evaluatedUserId },
      _max: { codigo: true },
    })
    const nextCodigo = (agg._max.codigo ?? 0) + 1

    const created = await prisma.individualPerformanceEvaluation.create({
      data: {
        evaluatedUserId,
        evaluatorUserId: session.user.id,
        codigo: nextCodigo,
        status: "RASCUNHO",
        selections: {},
        pontuacaoPercent: null,
      },
      select: { id: true },
    })
    revalidatePath("/individual/avaliacoes")
    return { id: created.id }
  } catch (e) {
    console.error("[createDraftIndividualPerformanceEvaluation]", e)
    return { error: evalPrismaMessage(e, "Não foi possível criar a avaliação.") }
  }
}

const createAndSaveBodySchema = z.object({
  evaluatedUserId: userIdSchema,
  selections: z.record(z.string(), z.number().int().min(0).max(4)),
  mode: z.enum(["save", "complete"]),
  periodo: periodoSchema.optional(),
})

/**
 * Cria e salva uma avaliação em uma única operação atômica.
 * Nenhum registro é gravado no banco até que este action seja chamado.
 * Retorna o ID do registro criado, ou um erro se os dados forem inválidos.
 */
export async function createAndSaveIndividualPerformanceEvaluation(
  raw: z.infer<typeof createAndSaveBodySchema>,
): Promise<{ id: string } | { error: string }> {
  const parsed = createAndSaveBodySchema.safeParse(raw)
  if (!parsed.success) return { error: "Dados inválidos." }

  try {
    const { session, canViewAll } = await requirePerformanceAccess()
    if (!canViewAll) return { error: "Criação de avaliações restrita a administradores MGR." }
    await assertEvaluatedUserInScope(parsed.data.evaluatedUserId, session.user.id, canViewAll)
    await ensureIndividualPerformanceEvaluationTable()

    // Sanitize: only known competency IDs, values 0-4
    const selections: Record<string, number> = {}
    for (const [k, v] of Object.entries(parsed.data.selections)) {
      if (PERFORMANCE_COMPETENCY_IDS.includes(k)) selections[k] = v
    }

    // All 23 competencies must be filled for both save and complete modes
    const complete = selectionsCompleteSchema.safeParse(selections)
    if (!complete.success) {
      return { error: "É preciso preencher todos os critérios de avaliação." }
    }

    const pontuacaoPercent = computePerformanceScorePercent(complete.data)
    if (pontuacaoPercent == null) return { error: "Não foi possível calcular a pontuação." }

    const periodoValue =
      parsed.data.periodo && isEvaluationPeriodSlug(parsed.data.periodo)
        ? parsed.data.periodo
        : DEFAULT_EVALUATION_PERIOD

    const agg = await prisma.individualPerformanceEvaluation.aggregate({
      where: { evaluatedUserId: parsed.data.evaluatedUserId },
      _max: { codigo: true },
    })
    const nextCodigo = (agg._max.codigo ?? 0) + 1

    const created = await prisma.individualPerformanceEvaluation.create({
      data: {
        evaluatedUserId: parsed.data.evaluatedUserId,
        evaluatorUserId: session.user.id,
        codigo: nextCodigo,
        status: parsed.data.mode === "complete" ? "CONCLUIDA" : "RASCUNHO",
        selections: selections as object,
        pontuacaoPercent,
        periodo: periodoValue,
      },
      select: { id: true },
    })
    revalidatePath("/individual/avaliacoes")

    if (parsed.data.mode === "complete") {
      try {
        await createNotification(
          parsed.data.evaluatedUserId,
          "EVALUATION",
          "Você recebeu uma avaliação de desempenho",
          "Uma nova avaliação foi registrada para você.",
          `/individual/minhas-avaliacoes/${created.id}`,
        )
      } catch (notifErr) {
        if (process.env.NODE_ENV !== "production")
          console.error("[createAndSaveIndividualPerformanceEvaluation] notification trigger:", notifErr)
      }
    }

    return { id: created.id }
  } catch (e) {
    console.error("[createAndSaveIndividualPerformanceEvaluation]", e)
    return { error: evalPrismaMessage(e, "Não foi possível criar a avaliação.") }
  }
}

const updateBodySchema = z.object({
  id: idSchema,
  selections: z.record(z.string(), z.number().int().min(0).max(4)),
  mode: z.enum(["save", "complete"]),
  periodo: periodoSchema.optional(),
})

export async function updateIndividualPerformanceEvaluation(
  raw: z.infer<typeof updateBodySchema>,
): Promise<{ error?: string }> {
  const parsed = updateBodySchema.safeParse(raw)
  if (!parsed.success) return { error: "Dados inválidos." }

  try {
    const { session, canViewAll } = await requirePerformanceAccess()
    if (!canViewAll) return { error: "Edição de avaliações restrita a administradores MGR." }
    await ensureIndividualPerformanceEvaluationTable()

    const existing = await prisma.individualPerformanceEvaluation.findUnique({
      where: { id: parsed.data.id },
    })
    if (!existing) return { error: "Avaliação não encontrada." }
    await assertEvaluatedUserInScope(existing.evaluatedUserId, session.user.id, canViewAll)

    const selections = { ...parsed.data.selections }
    for (const k of Object.keys(selections)) {
      if (!PERFORMANCE_COMPETENCY_IDS.includes(k)) delete selections[k]
    }

    let status = existing.status
    let pontuacaoPercent: number | null = existing.pontuacaoPercent

    if (parsed.data.mode === "complete") {
      const complete = selectionsCompleteSchema.safeParse(selections)
      if (!complete.success) {
        return { error: "Preencha todas as competências antes de concluir." }
      }
      status = "CONCLUIDA"
      pontuacaoPercent = computePerformanceScorePercent(complete.data)
    } else {
      status = "RASCUNHO"
      const score = computePerformanceScorePercent(selections)
      if (score == null) {
        return { error: "É preciso preencher todos os critérios de avaliação." }
      }
      pontuacaoPercent = score
    }

    await prisma.individualPerformanceEvaluation.update({
      where: { id: parsed.data.id },
      data: {
        selections: selections as object,
        status,
        pontuacaoPercent,
        ...(parsed.data.periodo !== undefined ? { periodo: parsed.data.periodo } : {}),
      },
    })
    revalidatePath("/individual/avaliacoes")
    revalidatePath(`/individual/avaliacoes/${parsed.data.id}`)

    if (parsed.data.mode === "complete") {
      try {
        await createNotification(
          existing.evaluatedUserId,
          "EVALUATION",
          "Você recebeu uma avaliação de desempenho",
          "Uma nova avaliação foi registrada para você.",
          `/individual/minhas-avaliacoes/${parsed.data.id}`,
        )
      } catch (notifErr) {
        if (process.env.NODE_ENV !== "production")
          console.error("[updateIndividualPerformanceEvaluation] notification trigger:", notifErr)
      }
    }

    return {}
  } catch (e) {
    console.error("[updateIndividualPerformanceEvaluation]", e)
    return { error: evalPrismaMessage(e, "Não foi possível salvar a avaliação.") }
  }
}

// ── Self-service: evaluated user views their own CONCLUIDA evaluations ────────

/**
 * Lista as avaliações CONCLUIDAS do próprio usuário autenticado (avaliado).
 * Não requer `individual.viewOthers` — restrito ao próprio userId da sessão.
 */
export async function listMyCompletedEvaluations(): Promise<IndividualPerformanceEvaluationListRow[]> {
  try {
    const session = await requireSession()
    await ensureIndividualPerformanceEvaluationTable()

    const rows = (await prisma.individualPerformanceEvaluation.findMany({
      where: { evaluatedUserId: session.user.id, status: "CONCLUIDA" },
      orderBy: [{ codigo: "desc" }],
      select: {
        id: true,
        codigo: true,
        updatedAt: true,
        pontuacaoPercent: true,
        status: true,
        periodo: true,
      },
    })) as {
      id: string
      codigo: number
      updatedAt: Date
      pontuacaoPercent: number | null
      status: string
      periodo: string | null
    }[]
    return rows.map((row) => ({
      id: row.id,
      codigo: row.codigo,
      dataYmd: ymdFromDate(row.updatedAt),
      pontuacaoPercent:
        row.pontuacaoPercent != null && !Number.isNaN(Number(row.pontuacaoPercent))
          ? Number(row.pontuacaoPercent)
          : null,
      status: row.status as IndividualPerformanceEvaluationStatusDto,
      periodo: row.periodo && isEvaluationPeriodSlug(row.periodo) ? row.periodo : DEFAULT_EVALUATION_PERIOD,
    }))
  } catch (e) {
    console.error("[listMyCompletedEvaluations]", e)
    return []
  }
}

/**
 * Retorna o detalhe de uma avaliação CONCLUIDA do próprio usuário autenticado.
 * Retorna null se não encontrar, não for CONCLUIDA, ou não pertencer ao usuário.
 */
export async function getMyCompletedEvaluation(
  id: string,
): Promise<IndividualPerformanceEvaluationDetail | null> {
  try {
    const session = await requireSession()
    const r = idSchema.safeParse(id)
    if (!r.success) return null
    await ensureIndividualPerformanceEvaluationTable()

    const row = await prisma.individualPerformanceEvaluation.findUnique({ where: { id } })
    if (!row) return null
    if (row.evaluatedUserId !== session.user.id) return null
    if (row.status !== "CONCLUIDA") return null

    const p = (row as { periodo?: string | null }).periodo
    return {
      id: row.id,
      evaluatedUserId: row.evaluatedUserId,
      codigo: row.codigo,
      status: "CONCLUIDA",
      selections: parseSelectionsJson(row.selections),
      pontuacaoPercent:
        row.pontuacaoPercent != null && !Number.isNaN(Number(row.pontuacaoPercent))
          ? Number(row.pontuacaoPercent)
          : null,
      periodo: p && isEvaluationPeriodSlug(p) ? p : DEFAULT_EVALUATION_PERIOD,
      dataYmd: ymdFromDate(row.updatedAt),
    }
  } catch (e) {
    console.error("[getMyCompletedEvaluation]", e)
    return null
  }
}

export async function deleteIndividualPerformanceEvaluation(id: string): Promise<{ error?: string }> {
  const r = idSchema.safeParse(id)
  if (!r.success) return { error: "ID inválido." }

  try {
    const { session, canViewAll } = await requirePerformanceAccess()
    if (!canViewAll) return { error: "Exclusão de avaliações restrita a administradores MGR." }
    await ensureIndividualPerformanceEvaluationTable()

    const existing = await prisma.individualPerformanceEvaluation.findUnique({
      where: { id },
      select: { evaluatedUserId: true },
    })
    if (!existing) return { error: "Avaliação não encontrada." }
    await assertEvaluatedUserInScope(existing.evaluatedUserId, session.user.id, canViewAll)

    await prisma.individualPerformanceEvaluation.delete({ where: { id } })
    revalidatePath("/individual/avaliacoes")
    return {}
  } catch (e) {
    console.error("[deleteIndividualPerformanceEvaluation]", e)
    return { error: evalPrismaMessage(e, "Não foi possível remover a avaliação.") }
  }
}
