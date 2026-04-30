"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { ensureIndividualPerformanceEvaluationTable } from "@/lib/prisma-schema-ensure"
import { requireSession } from "@/lib/session"
import { buildRole, can } from "@/lib/rbac/policy"
import { getActiveQaUsers } from "@/lib/actions/usuarios"
import {
  computePerformanceScorePercent,
  DEFAULT_EVALUATION_PERIOD,
  isEvaluationPeriodSlug,
  parseSelectionsJson,
  PERFORMANCE_COMPETENCY_IDS,
  selectionsCompleteSchema,
} from "@/lib/individual-performance-evaluation"

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

async function requireMgrPerformanceAccess(): Promise<{
  session: NonNullable<Awaited<ReturnType<typeof requireSession>>>
}> {
  const session = await requireSession()
  const role = buildRole(session.user.type, session.user.accessProfile)
  if (!can(role, "individual.viewOthers")) {
    throw new Error("Não autorizado.")
  }
  if (session.user.type !== "Administrador") {
    throw new Error("Não autorizado.")
  }
  return { session }
}

async function assertEvaluatedUserInScope(evaluatedUserId: string): Promise<void> {
  const r = userIdSchema.safeParse(evaluatedUserId)
  if (!r.success) throw new Error("Usuário inválido.")
  const users = await getActiveQaUsers()
  const ok = users.some((u) => u.id === evaluatedUserId)
  if (!ok) throw new Error("Usuário não encontrado ou inativo.")
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
  await requireMgrPerformanceAccess()
  await assertEvaluatedUserInScope(evaluatedUserId)
  await ensureIndividualPerformanceEvaluationTable()

  try {
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
      pontuacaoPercent: row.pontuacaoPercent,
      status: row.status as IndividualPerformanceEvaluationStatusDto,
      periodo: row.periodo && isEvaluationPeriodSlug(row.periodo) ? row.periodo : DEFAULT_EVALUATION_PERIOD,
    }))
  } catch (e) {
    console.error("[listIndividualPerformanceEvaluations]", e)
    throw new Error(evalPrismaMessage(e, "Não foi possível carregar as avaliações."))
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
}

export async function getIndividualPerformanceEvaluation(
  id: string,
): Promise<IndividualPerformanceEvaluationDetail | null> {
  await requireMgrPerformanceAccess()
  const r = idSchema.safeParse(id)
  if (!r.success) return null
  await ensureIndividualPerformanceEvaluationTable()

  try {
    const row = await prisma.individualPerformanceEvaluation.findUnique({
      where: { id },
    })
    if (!row) return null
    await assertEvaluatedUserInScope(row.evaluatedUserId)
    const p = (row as { periodo?: string | null }).periodo
    return {
      id: row.id,
      evaluatedUserId: row.evaluatedUserId,
      codigo: row.codigo,
      status: row.status as IndividualPerformanceEvaluationStatusDto,
      selections: parseSelectionsJson(row.selections),
      pontuacaoPercent: row.pontuacaoPercent,
      periodo: p && isEvaluationPeriodSlug(p) ? p : DEFAULT_EVALUATION_PERIOD,
    }
  } catch (e) {
    console.error("[getIndividualPerformanceEvaluation]", e)
    return null
  }
}

export async function createDraftIndividualPerformanceEvaluation(
  evaluatedUserId: string,
): Promise<{ id: string } | { error: string }> {
  try {
    const { session } = await requireMgrPerformanceAccess()
    await assertEvaluatedUserInScope(evaluatedUserId)
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
    await requireMgrPerformanceAccess()
    await ensureIndividualPerformanceEvaluationTable()

    const existing = await prisma.individualPerformanceEvaluation.findUnique({
      where: { id: parsed.data.id },
    })
    if (!existing) return { error: "Avaliação não encontrada." }
    await assertEvaluatedUserInScope(existing.evaluatedUserId)

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
    return {}
  } catch (e) {
    console.error("[updateIndividualPerformanceEvaluation]", e)
    return { error: evalPrismaMessage(e, "Não foi possível salvar a avaliação.") }
  }
}

export async function deleteIndividualPerformanceEvaluation(id: string): Promise<{ error?: string }> {
  const r = idSchema.safeParse(id)
  if (!r.success) return { error: "ID inválido." }

  try {
    await requireMgrPerformanceAccess()
    await ensureIndividualPerformanceEvaluationTable()

    const existing = await prisma.individualPerformanceEvaluation.findUnique({
      where: { id },
      select: { evaluatedUserId: true },
    })
    if (!existing) return { error: "Avaliação não encontrada." }
    await assertEvaluatedUserInScope(existing.evaluatedUserId)

    await prisma.individualPerformanceEvaluation.delete({ where: { id } })
    revalidatePath("/individual/avaliacoes")
    return {}
  } catch (e) {
    console.error("[deleteIndividualPerformanceEvaluation]", e)
    return { error: evalPrismaMessage(e, "Não foi possível remover a avaliação.") }
  }
}
