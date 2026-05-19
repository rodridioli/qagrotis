"use server"

import { z } from "zod"
import { prisma } from "@/core/prisma"
import { requireSession } from "@/core/session"
import { buildRole, can } from "@/core/rbac/policy"
import { ensureDominioTables, ensureNotificationTables } from "@/core/prisma-schema-ensure"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DominioModulo {
  id: string
  nome: string
}

export interface DominioProduto {
  id: string
  nome: string
  modulos: DominioModulo[]
}

export interface DominioAvaliacaoListRow {
  id: string
  codigo: number
  /** ISO yyyy-mm-dd (data de conclusão ou criação). */
  dataYmd: string
  /** ISO 8601 completo — data/hora de criação (solicitação). */
  createdAtIso: string
  resultadoPercent: number | null
  status: "PENDENTE" | "CONCLUIDA"
}

export interface DominioAvaliacaoResposta {
  produtoId: string
  moduloId: string
  estrelas: number
}

export interface PendingDominioAvaliacaoDto {
  id: string
  configSnapshot: DominioProduto[]
  /** Respostas da avaliação CONCLUIDA mais recente do mesmo usuário, para pré-preenchimento. */
  respostasAnteriores?: DominioAvaliacaoResposta[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function assertMgr() {
  const session = await requireSession()
  const role = buildRole(session.user.type, session.user.accessProfile)
  if (!can(role, "individual.viewOthers")) {
    throw new Error("Acesso restrito a Administrador:MGR.")
  }
  return session
}

function calcResultado(respostas: DominioAvaliacaoResposta[], snapshot: DominioProduto[]): number {
  if (snapshot.length === 0 || respostas.length === 0) return 0
  const productAvgs: number[] = []
  for (const produto of snapshot) {
    if (produto.modulos.length === 0) continue
    const scores: number[] = []
    for (const modulo of produto.modulos) {
      const r = respostas.find((x) => x.produtoId === produto.id && x.moduloId === modulo.id)
      if (r) scores.push((r.estrelas / 5) * 100)
    }
    if (scores.length > 0) {
      productAvgs.push(scores.reduce((a, b) => a + b, 0) / scores.length)
    }
  }
  if (productAvgs.length === 0) return 0
  return productAvgs.reduce((a, b) => a + b, 0) / productAvgs.length
}

function toDateYmd(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`
}

// ─── Read: Configuração Global ─────────────────────────────────────────────────

export async function getDominioConfiguracao(): Promise<DominioProduto[]> {
  await ensureDominioTables()
  try {
    const row = await prisma.dominioConfiguracao.findUnique({ where: { id: "global" } })
    if (!row) return []
    return (row.produtos as unknown as DominioProduto[]) ?? []
  } catch (e) {
    console.error("[getDominioConfiguracao]", e)
    return []
  }
}

// ─── Write: Configuração Global (MGR only) ─────────────────────────────────────

const produtosSchema = z.array(
  z.object({
    id: z.string().min(1),
    nome: z.string().min(1).max(200),
    modulos: z.array(
      z.object({
        id: z.string().min(1),
        nome: z.string().min(1).max(200),
      }),
    ),
  }),
)

export async function saveDominioConfiguracao(
  produtos: DominioProduto[],
): Promise<{ error?: string }> {
  const parsed = produtosSchema.safeParse(produtos)
  if (!parsed.success) return { error: "Dados inválidos." }

  try {
    const session = await assertMgr()
    await ensureDominioTables()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const produtosJson = parsed.data as any
    await prisma.dominioConfiguracao.upsert({
      where: { id: "global" },
      create: {
        id: "global",
        produtos: produtosJson,
        updatedByUserId: session.user.id,
      },
      update: {
        produtos: produtosJson,
        updatedByUserId: session.user.id,
      },
    })
    return {}
  } catch (e) {
    console.error("[saveDominioConfiguracao]", e)
    return { error: "Não foi possível salvar a configuração." }
  }
}

// ─── Read: Listagem de Avaliações ─────────────────────────────────────────────

export async function listDominioAvaliacoes(
  evaluatedUserId: string,
): Promise<DominioAvaliacaoListRow[]> {
  const session = await requireSession()
  const role = buildRole(session.user.type, session.user.accessProfile)
  const canViewOthers = can(role, "individual.viewOthers")

  if (!canViewOthers && session.user.id !== evaluatedUserId) return []

  await ensureDominioTables()
  try {
    const rows = await prisma.dominioAvaliacao.findMany({
      where: { evaluatedUserId },
      orderBy: { codigo: "desc" },
      select: {
        id: true,
        codigo: true,
        status: true,
        resultadoPercent: true,
        createdAt: true,
        updatedAt: true,
      },
    })
    return rows.map((r) => ({
      id: r.id,
      codigo: r.codigo,
      dataYmd: toDateYmd(r.status === "CONCLUIDA" ? r.updatedAt : r.createdAt),
      createdAtIso: r.createdAt.toISOString(),
      resultadoPercent: r.resultadoPercent,
      status: r.status as "PENDENTE" | "CONCLUIDA",
    }))
  } catch (e) {
    console.error("[listDominioAvaliacoes]", e)
    return []
  }
}

// ─── Read: Avaliação Pendente do Usuário Logado ───────────────────────────────

export async function getPendingDominioAvaliacao(): Promise<PendingDominioAvaliacaoDto | null> {
  try {
    const session = await requireSession()
    await ensureDominioTables()

    const [pending, anterior] = await Promise.all([
      prisma.dominioAvaliacao.findFirst({
        where: { evaluatedUserId: session.user.id, status: "PENDENTE" },
        orderBy: { createdAt: "asc" },
        select: { id: true, configSnapshot: true },
      }),
      prisma.dominioAvaliacao.findFirst({
        where: { evaluatedUserId: session.user.id, status: "CONCLUIDA" },
        orderBy: { updatedAt: "desc" },
        select: { respostas: true },
      }),
    ])

    if (!pending) return null

    const respostasAnteriores = anterior
      ? ((anterior.respostas as unknown as DominioAvaliacaoResposta[]) ?? [])
      : undefined

    return {
      id: pending.id,
      configSnapshot: (pending.configSnapshot as unknown as DominioProduto[]) ?? [],
      respostasAnteriores,
    }
  } catch (e) {
    console.error("[getPendingDominioAvaliacao]", e)
    return null
  }
}

// ─── Write: Solicitar Avaliação (MGR only) ────────────────────────────────────

export async function solicitarDominioAvaliacao(
  evaluatedUserId: string,
): Promise<{ error?: string }> {
  if (!evaluatedUserId?.trim()) return { error: "Usuário inválido." }

  try {
    const session = await assertMgr()
    await ensureDominioTables()
    await ensureNotificationTables()

    const existing = await prisma.dominioAvaliacao.findFirst({
      where: { evaluatedUserId, status: "PENDENTE" },
      select: { id: true },
    })
    if (existing) {
      return { error: "Este usuário já possui uma avaliação de domínio pendente." }
    }

    const config = await getDominioConfiguracao()
    if (config.length === 0) {
      return {
        error: "Configure pelo menos um produto com módulos antes de solicitar uma avaliação.",
      }
    }
    const hasModules = config.some((p) => p.modulos.length > 0)
    if (!hasModules) {
      return { error: "Adicione pelo menos um módulo a um produto antes de solicitar uma avaliação." }
    }

    const count = await prisma.dominioAvaliacao.count({ where: { evaluatedUserId } })
    const nextCodigo = count + 1

    await prisma.dominioAvaliacao.create({
      data: {
        evaluatedUserId,
        solicitadaPorId: session.user.id,
        codigo: nextCodigo,
        status: "PENDENTE",
        respostas: [],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        configSnapshot: config as any,
      },
    })

    await prisma.notification.create({
      data: {
        userId: evaluatedUserId,
        type: "DOMAIN_EVALUATION" as never,
        title: "Avaliação de Domínio solicitada",
        message:
          "Você recebeu uma solicitação de avaliação de domínio de produto. Por favor, acesse o sistema para preenchê-la.",
        link: "/individual/dominio",
      },
    })

    return {}
  } catch (e) {
    console.error("[solicitarDominioAvaliacao]", e)
    return { error: "Não foi possível solicitar a avaliação." }
  }
}

// ─── Write: Completar Avaliação (usuário avaliado) ────────────────────────────

const respostasSchema = z.array(
  z.object({
    produtoId: z.string().min(1),
    moduloId: z.string().min(1),
    estrelas: z.number().int().min(1).max(5),
  }),
)

export async function completarDominioAvaliacao(
  id: string,
  respostas: DominioAvaliacaoResposta[],
): Promise<{ error?: string }> {
  if (!id?.trim()) return { error: "ID inválido." }
  const parsed = respostasSchema.safeParse(respostas)
  if (!parsed.success) return { error: "Respostas inválidas." }

  try {
    const session = await requireSession()
    await ensureDominioTables()

    const row = await prisma.dominioAvaliacao.findUnique({
      where: { id },
      select: { evaluatedUserId: true, status: true, configSnapshot: true },
    })
    if (!row) return { error: "Avaliação não encontrada." }
    if (row.evaluatedUserId !== session.user.id) return { error: "Não autorizado." }
    if (row.status !== "PENDENTE") return { error: "Esta avaliação já foi preenchida." }

    const snapshot = (row.configSnapshot as unknown as DominioProduto[]) ?? []
    const resultado = calcResultado(parsed.data, snapshot)

    await prisma.dominioAvaliacao.update({
      where: { id },
      data: {
        status: "CONCLUIDA",
        resultadoPercent: resultado,
        respostas: parsed.data,
      },
    })

    return {}
  } catch (e) {
    console.error("[completarDominioAvaliacao]", e)
    return { error: "Não foi possível salvar a avaliação." }
  }
}

// ─── Read: Detalhe de uma Avaliação ──────────────────────────────────────────

export interface DominioAvaliacaoDetalhe {
  id: string
  codigo: number
  status: "PENDENTE" | "CONCLUIDA"
  dataYmd: string
  resultadoPercent: number | null
  configSnapshot: DominioProduto[]
  respostas: DominioAvaliacaoResposta[]
  produtoMedias: { produtoId: string; nome: string; media: number | null }[]
}

export async function getDominioAvaliacaoDetalhe(
  id: string,
): Promise<DominioAvaliacaoDetalhe | null> {
  if (!id?.trim()) return null
  try {
    const session = await requireSession()
    const role = buildRole(session.user.type, session.user.accessProfile)
    const canViewOthers = can(role, "individual.viewOthers")

    await ensureDominioTables()
    const row = await prisma.dominioAvaliacao.findUnique({
      where: { id },
      select: {
        id: true,
        codigo: true,
        status: true,
        resultadoPercent: true,
        createdAt: true,
        updatedAt: true,
        evaluatedUserId: true,
        configSnapshot: true,
        respostas: true,
      },
    })
    if (!row) return null
    if (!canViewOthers && row.evaluatedUserId !== session.user.id) return null

    const snapshot = (row.configSnapshot as unknown as DominioProduto[]) ?? []
    const respostas = (row.respostas as unknown as DominioAvaliacaoResposta[]) ?? []

    const produtoMedias = snapshot.map((p) => {
      const scores: number[] = []
      for (const m of p.modulos) {
        const r = respostas.find((x) => x.produtoId === p.id && x.moduloId === m.id)
        if (r) scores.push((r.estrelas / 5) * 100)
      }
      return {
        produtoId: p.id,
        nome: p.nome,
        media: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
      }
    })

    return {
      id: row.id,
      codigo: row.codigo,
      status: row.status as "PENDENTE" | "CONCLUIDA",
      dataYmd: toDateYmd(row.status === "CONCLUIDA" ? row.updatedAt : row.createdAt),
      resultadoPercent: row.resultadoPercent,
      configSnapshot: snapshot,
      respostas,
      produtoMedias,
    }
  } catch (e) {
    console.error("[getDominioAvaliacaoDetalhe]", e)
    return null
  }
}

// ─── Write: Excluir Avaliação (MGR only) ──────────────────────────────────────

export async function deleteDominioAvaliacao(id: string): Promise<{ error?: string }> {
  if (!id?.trim()) return { error: "ID inválido." }
  try {
    await assertMgr()
    await ensureDominioTables()
    await prisma.dominioAvaliacao.delete({ where: { id } })
    return {}
  } catch (e) {
    console.error("[deleteDominioAvaliacao]", e)
    return { error: "Não foi possível excluir a avaliação." }
  }
}
