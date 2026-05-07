"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import {
  ensureIndividualFeedbackTable,
  ensureIndividualFeedbackPeriodoColumn,
} from "@/lib/prisma-schema-ensure"
import { requireSession } from "@/lib/session"
import { buildRole, can } from "@/lib/rbac/policy"
import { getActiveQaUsers } from "@/actions/usuarios"
import {
  isFeedbackTipoSlug,
  FEEDBACK_TIPO_SLUGS,
  type FeedbackTipoSlug,
  type FeedbackCampos,
  type IndividualFeedbackListRow,
  type IndividualFeedbackDetail,
  type IndividualFeedbackStatusDto,
} from "@/lib/individual-feedback"

// ── Validation schemas (private) ──────────────────────────────────────────────

const userIdSchema = z.string().min(1).max(128)
const idSchema = z.string().min(1).max(128)

const camposPositivoSchema = z.object({
  contexto: z.string().min(1, "Contexto é obrigatório").max(5000),
  feedback: z.string().min(1, "Feedback é obrigatório").max(5000),
  impacto: z.string().min(1, "Impacto é obrigatório").max(5000),
})

const camposDesenvolvimentoSchema = z.object({
  contexto: z.string().min(1, "Contexto é obrigatório").max(5000),
  feedback: z.string().min(1, "Feedback é obrigatório").max(5000),
  impacto: z.string().min(1, "Impacto é obrigatório").max(5000),
  sugestao: z.string().min(1, "Sugestão é obrigatória").max(5000),
})

const camposCorretivoSchema = z.object({
  contexto: z.string().min(1, "Contexto é obrigatório").max(5000),
  feedback: z.string().min(1, "Feedback é obrigatório").max(5000),
  impacto: z.string().min(1, "Impacto é obrigatório").max(5000),
  acaoEsperada: z.string().min(1, "Ação esperada é obrigatória").max(5000),
})

const camposFormalCicloSchema = z.object({
  pontosPositivos: z.string().min(1, "Pontos positivos são obrigatórios").max(5000),
  pontosMelhoria: z.string().min(1, "Pontos de melhoria são obrigatórios").max(5000),
  avaliacaoGeral: z.string().min(1, "Avaliação geral é obrigatória").max(5000),
  proximosPassos: z.string().min(1, "Próximos passos são obrigatórios").max(5000),
})

const camposTrezentosSessentaSchema = z.object({
  contexto: z.string().min(1, "Contexto é obrigatório").max(5000),
  percepcaoPares: z.string().min(1, "Percepção dos pares é obrigatória").max(5000),
  percepcaoLider: z.string().min(1, "Percepção do líder é obrigatória").max(5000),
  resumo: z.string().min(1, "Resumo é obrigatório").max(5000),
})

const camposPositivoDraftSchema = camposPositivoSchema.partial()
const camposDesenvolvimentoDraftSchema = camposDesenvolvimentoSchema.partial()
const camposCorretivoDraftSchema = camposCorretivoSchema.partial()
const camposFormalCicloDraftSchema = camposFormalCicloSchema.partial()
const camposTrezentosSessentaDraftSchema = camposTrezentosSessentaSchema.partial()

function parseCamposForTipo(
  tipo: FeedbackTipoSlug,
  campos: unknown,
  mode: "save" | "complete",
): FeedbackCampos {
  if (mode === "complete") {
    switch (tipo) {
      case "POSITIVO":         return camposPositivoSchema.parse(campos)
      case "DESENVOLVIMENTO":  return camposDesenvolvimentoSchema.parse(campos)
      case "CORRETIVO":        return camposCorretivoSchema.parse(campos)
      case "FORMAL_CICLO":     return camposFormalCicloSchema.parse(campos)
      case "TREZENTOS_SESSENTA": return camposTrezentosSessentaSchema.parse(campos)
    }
  }
  switch (tipo) {
    case "POSITIVO":         return camposPositivoDraftSchema.parse(campos) as FeedbackCampos
    case "DESENVOLVIMENTO":  return camposDesenvolvimentoDraftSchema.parse(campos) as FeedbackCampos
    case "CORRETIVO":        return camposCorretivoDraftSchema.parse(campos) as FeedbackCampos
    case "FORMAL_CICLO":     return camposFormalCicloDraftSchema.parse(campos) as FeedbackCampos
    case "TREZENTOS_SESSENTA": return camposTrezentosSessentaDraftSchema.parse(campos) as FeedbackCampos
  }
}

// ── Auth helpers (private async) ──────────────────────────────────────────────

async function requireMgrFeedbackAccess() {
  const session = await requireSession()
  const role = buildRole(session.user.type, session.user.accessProfile)
  if (!can(role, "individual.viewOthers")) throw new Error("Não autorizado.")
  if (session.user.type !== "Administrador") throw new Error("Não autorizado.")
  return { session }
}

async function assertEvaluatedUserInScope(evaluatedUserId: string): Promise<void> {
  const r = userIdSchema.safeParse(evaluatedUserId)
  if (!r.success) throw new Error("Usuário inválido.")
  const users = await getActiveQaUsers()
  if (!users.some((u) => u.id === evaluatedUserId)) throw new Error("Usuário não encontrado ou inativo.")
}

function ymdFromDate(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, "0")
  const day = String(d.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/** Garante que o modelo Prisma foi gerado (client pode ficar em cache antigo no dev). */
function assertFeedbackModelReady(): void {
  const model = (prisma as unknown as Record<string, unknown>)["individualFeedback"]
  if (!model) {
    throw new Error(
      "Prisma client desatualizado — execute 'npx prisma generate' e reinicie o servidor de desenvolvimento.",
    )
  }
}

function evalPrismaMessage(e: unknown, fallback: string): string {
  const msg =
    typeof e === "object" && e !== null && "message" in e
      ? String((e as { message: string }).message)
      : String(e)
  if (/does not exist|não existe|relation|P2021/i.test(msg)) {
    return "Tabela de feedbacks ainda não existe. Recarregue a página ou rode as migrações Prisma."
  }
  if (/desatualizado|prisma generate/i.test(msg)) return msg
  return fallback
}

function rowToDetail(row: {
  id: string
  evaluatedUserId: string
  codigo: number
  tipo: string
  periodo?: string | null
  status: string
  campos: unknown
  updatedAt: Date
}): IndividualFeedbackDetail {
  const tipo = isFeedbackTipoSlug(row.tipo) ? row.tipo : "POSITIVO"
  return {
    id: row.id,
    evaluatedUserId: row.evaluatedUserId,
    codigo: row.codigo,
    tipo,
    periodo: row.periodo ?? "T1_TRIMESTRE",
    status: (row.status as IndividualFeedbackStatusDto) ?? "RASCUNHO",
    campos: (row.campos ?? {}) as FeedbackCampos,
    dataYmd: ymdFromDate(row.updatedAt),
  }
}

// ── Public async server actions ───────────────────────────────────────────────

export async function listIndividualFeedbacks(
  evaluatedUserId: string,
): Promise<IndividualFeedbackListRow[]> {
  await requireMgrFeedbackAccess()
  await assertEvaluatedUserInScope(evaluatedUserId)
  await ensureIndividualFeedbackTable()
  await ensureIndividualFeedbackPeriodoColumn()
  assertFeedbackModelReady()

  try {
    const rows = (await prisma.individualFeedback.findMany({
      where: { evaluatedUserId },
      orderBy: [{ codigo: "desc" }],
      select: { id: true, codigo: true, updatedAt: true, tipo: true, periodo: true, status: true },
    })) as { id: string; codigo: number; updatedAt: Date; tipo: string; periodo?: string | null; status: string }[]

    return rows.map((row) => ({
      id: row.id,
      codigo: row.codigo,
      dataYmd: ymdFromDate(row.updatedAt),
      tipo: isFeedbackTipoSlug(row.tipo) ? row.tipo : "POSITIVO",
      periodo: row.periodo ?? "T1_TRIMESTRE",
      status: row.status as IndividualFeedbackStatusDto,
    }))
  } catch (e) {
    console.error("[listIndividualFeedbacks]", e)
    throw new Error(evalPrismaMessage(e, "Não foi possível carregar os feedbacks."))
  }
}

export async function getIndividualFeedback(
  id: string,
): Promise<IndividualFeedbackDetail | null> {
  await requireMgrFeedbackAccess()
  const r = idSchema.safeParse(id)
  if (!r.success) return null
  await ensureIndividualFeedbackTable()
  await ensureIndividualFeedbackPeriodoColumn()
  assertFeedbackModelReady()

  try {
    const row = (await prisma.individualFeedback.findUnique({ where: { id } })) as {
      id: string
      evaluatedUserId: string
      codigo: number
      tipo: string
      status: string
      campos: unknown
      updatedAt: Date
    } | null
    if (!row) return null
    return rowToDetail(row)
  } catch (e) {
    console.error("[getIndividualFeedback]", e)
    return null
  }
}

export async function createAndSaveIndividualFeedback(input: {
  evaluatedUserId: string
  tipo: FeedbackTipoSlug
  periodo: string
  campos: unknown
  mode: "save" | "complete"
}): Promise<{ id: string } | { error: string }> {
  try {
    const { session } = await requireMgrFeedbackAccess()
    await assertEvaluatedUserInScope(input.evaluatedUserId)

    const tipoR = z.enum(FEEDBACK_TIPO_SLUGS).safeParse(input.tipo)
    if (!tipoR.success) return { error: "Tipo de feedback inválido." }

    const periodoR = z
      .enum(["T1_TRIMESTRE", "T2_TRIMESTRE", "T3_TRIMESTRE", "T4_TRIMESTRE", "S1_SEMESTRE", "S2_SEMESTRE"])
      .safeParse(input.periodo)
    if (!periodoR.success) return { error: "Período inválido." }

    let campos: FeedbackCampos
    try {
      campos = parseCamposForTipo(tipoR.data, input.campos, input.mode)
    } catch (e) {
      if (e instanceof z.ZodError) {
        return { error: e.issues[0]?.message ?? "Campos inválidos." }
      }
      return { error: "Campos inválidos." }
    }

    await ensureIndividualFeedbackTable()
  await ensureIndividualFeedbackPeriodoColumn()

    const existing = (await prisma.individualFeedback.findMany({
      where: { evaluatedUserId: input.evaluatedUserId },
      select: { codigo: true },
      orderBy: { codigo: "desc" },
    })) as { codigo: number }[]
    const nextCodigo = existing.length > 0 ? (existing[0]?.codigo ?? 0) + 1 : 1

    const row = (await prisma.individualFeedback.create({
      data: {
        evaluatedUserId: input.evaluatedUserId,
        evaluatorUserId: session.user.id,
        codigo: nextCodigo,
        tipo: tipoR.data,
        periodo: periodoR.data,
        status: input.mode === "complete" ? "CONCLUIDA" : "RASCUNHO",
        campos: campos as object,
      },
      select: { id: true },
    })) as { id: string }

    revalidatePath(`/individual/feedbacks`)
    return { id: row.id }
  } catch (e) {
    console.error("[createAndSaveIndividualFeedback]", e)
    if (e instanceof Error) return { error: e.message }
    return { error: "Não foi possível salvar o feedback." }
  }
}

export async function updateIndividualFeedback(input: {
  id: string
  tipo: FeedbackTipoSlug
  periodo: string
  campos: unknown
  mode: "save" | "complete"
}): Promise<{ error?: string }> {
  try {
    await requireMgrFeedbackAccess()
    const idR = idSchema.safeParse(input.id)
    if (!idR.success) return { error: "ID inválido." }

    const tipoR = z.enum(FEEDBACK_TIPO_SLUGS).safeParse(input.tipo)
    if (!tipoR.success) return { error: "Tipo de feedback inválido." }

    const periodoR = z
      .enum(["T1_TRIMESTRE", "T2_TRIMESTRE", "T3_TRIMESTRE", "T4_TRIMESTRE", "S1_SEMESTRE", "S2_SEMESTRE"])
      .safeParse(input.periodo)
    if (!periodoR.success) return { error: "Período inválido." }

    await ensureIndividualFeedbackTable()
  await ensureIndividualFeedbackPeriodoColumn()

    const existing = (await prisma.individualFeedback.findUnique({
      where: { id: idR.data },
      select: { status: true },
    })) as { status: string } | null

    if (!existing) return { error: "Feedback não encontrado." }
    if (existing.status === "CONCLUIDA") return { error: "Feedback concluído não pode ser editado." }

    let campos: FeedbackCampos
    try {
      campos = parseCamposForTipo(tipoR.data, input.campos, input.mode)
    } catch (e) {
      if (e instanceof z.ZodError) {
        return { error: e.issues[0]?.message ?? "Campos inválidos." }
      }
      return { error: "Campos inválidos." }
    }

    await prisma.individualFeedback.update({
      where: { id: idR.data },
      data: {
        tipo: tipoR.data,
        periodo: periodoR.data,
        status: input.mode === "complete" ? "CONCLUIDA" : "RASCUNHO",
        campos: campos as object,
        updatedAt: new Date(),
      },
    })

    revalidatePath(`/individual/feedbacks`)
    revalidatePath(`/individual/feedbacks/${idR.data}`)
    return {}
  } catch (e) {
    console.error("[updateIndividualFeedback]", e)
    if (e instanceof Error) return { error: e.message }
    return { error: "Não foi possível salvar o feedback." }
  }
}

export async function deleteIndividualFeedback(id: string): Promise<{ error?: string }> {
  try {
    await requireMgrFeedbackAccess()
    const idR = idSchema.safeParse(id)
    if (!idR.success) return { error: "ID inválido." }

    await ensureIndividualFeedbackTable()
  await ensureIndividualFeedbackPeriodoColumn()

    const existing = (await prisma.individualFeedback.findUnique({
      where: { id: idR.data },
      select: { id: true },
    })) as { id: string } | null

    if (!existing) return { error: "Feedback não encontrado." }

    await prisma.individualFeedback.delete({ where: { id: idR.data } })
    revalidatePath(`/individual/feedbacks`)
    return {}
  } catch (e) {
    console.error("[deleteIndividualFeedback]", e)
    if (e instanceof Error) return { error: e.message }
    return { error: "Não foi possível remover o feedback." }
  }
}

/**
 * Lista os feedbacks CONCLUÍDOS do próprio usuário autenticado (avaliado).
 * Não requer `individual.viewOthers` — restrito ao próprio userId da sessão.
 */
export async function listMyCompletedFeedbacks(): Promise<IndividualFeedbackListRow[]> {
  const session = await requireSession()
  await ensureIndividualFeedbackTable()
  await ensureIndividualFeedbackPeriodoColumn()

  try {
    const rows = (await prisma.individualFeedback.findMany({
      where: { evaluatedUserId: session.user.id, status: "CONCLUIDA" },
      orderBy: [{ codigo: "desc" }],
      select: { id: true, codigo: true, updatedAt: true, tipo: true, periodo: true, status: true },
    })) as { id: string; codigo: number; updatedAt: Date; tipo: string; periodo?: string | null; status: string }[]

    return rows.map((row) => ({
      id: row.id,
      codigo: row.codigo,
      dataYmd: ymdFromDate(row.updatedAt),
      tipo: isFeedbackTipoSlug(row.tipo) ? row.tipo : "POSITIVO",
      periodo: row.periodo ?? "T1_TRIMESTRE",
      status: row.status as IndividualFeedbackStatusDto,
    }))
  } catch (e) {
    console.error("[listMyCompletedFeedbacks]", e)
    throw new Error(evalPrismaMessage(e, "Não foi possível carregar os feedbacks."))
  }
}

/**
 * Retorna o detalhe de um feedback CONCLUÍDO do próprio usuário autenticado.
 * Retorna null se não encontrar, não for CONCLUIDA, ou não pertencer ao usuário.
 */
export async function getMyCompletedFeedback(id: string): Promise<IndividualFeedbackDetail | null> {
  const session = await requireSession()
  const r = idSchema.safeParse(id)
  if (!r.success) return null
  await ensureIndividualFeedbackTable()
  await ensureIndividualFeedbackPeriodoColumn()

  try {
    const row = (await prisma.individualFeedback.findUnique({
      where: { id: r.data },
    })) as {
      id: string
      evaluatedUserId: string
      codigo: number
      tipo: string
      periodo?: string | null
      status: string
      campos: unknown
      updatedAt: Date
    } | null

    if (!row) return null
    if (row.evaluatedUserId !== session.user.id) return null
    if (row.status !== "CONCLUIDA") return null

    return rowToDetail(row)
  } catch (e) {
    console.error("[getMyCompletedFeedback]", e)
    return null
  }
}
