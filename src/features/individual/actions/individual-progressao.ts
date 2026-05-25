"use server"

import { randomUUID } from "crypto"
import { z } from "zod"
import { prisma } from "@/core/prisma"
import { createNotification } from "@/core/actions/notifications"
import {
  ensureIndividualProgressaoTable,
  ensureIndividualProgressaoCargoColumn,
  ensureIndividualProgressaoValorHoraColumn,
  ensureUserClassificacaoColumns,
} from "@/core/prisma-schema-ensure"
import { requireSession } from "@/core/session"
import { buildRole, can } from "@/core/rbac/policy"
import type { ProgressaoListRow } from "@/features/individual/lib/individual-progressao"

async function requireMgr() {
  const session = await requireSession()
  const role = buildRole(session.user.type, session.user.accessProfile)
  if (!can(role, "individual.viewOthers")) throw new Error("Sem permissão.")
  return session
}

interface RawRow {
  id: string
  codigo: number
  data: Date
  tipo: string
  regime: string
  cargo: string | null
  valorHora: number | null
  valor: number
}

function toRow(p: RawRow): ProgressaoListRow {
  return {
    id: p.id,
    codigo: p.codigo,
    dataYmd: p.data.toISOString().slice(0, 10),
    tipo: p.tipo as ProgressaoListRow["tipo"],
    regime: p.regime as ProgressaoListRow["regime"],
    cargo: p.cargo ?? "",
    valorHora: p.valorHora ?? null,
    valor: p.valor,
  }
}

/** MGR: lista progressões de um usuário específico. */
export async function listProgressoes(evaluatedUserId: string): Promise<ProgressaoListRow[]> {
  await requireMgr()
  await ensureIndividualProgressaoTable()
  await ensureIndividualProgressaoCargoColumn()
  await ensureIndividualProgressaoValorHoraColumn()
  const parsed = z.string().min(1).max(128).safeParse(evaluatedUserId)
  if (!parsed.success) throw new Error("ID de usuário inválido.")
  const rows = await prisma.$queryRaw<RawRow[]>`
    SELECT id, codigo, data, tipo, regime, cargo, "valorHora", valor
    FROM "IndividualProgressao"
    WHERE "evaluatedUserId" = ${parsed.data}
    ORDER BY data DESC
  `
  return rows.map(toRow)
}

/** Usuário autenticado: lista apenas as próprias progressões. */
export async function listMinhasProgressoes(): Promise<ProgressaoListRow[]> {
  const session = await requireSession()
  await ensureIndividualProgressaoTable()
  await ensureIndividualProgressaoCargoColumn()
  await ensureIndividualProgressaoValorHoraColumn()
  const rows = await prisma.$queryRaw<RawRow[]>`
    SELECT id, codigo, data, tipo, regime, cargo, "valorHora", valor
    FROM "IndividualProgressao"
    WHERE "evaluatedUserId" = ${session.user.id}
    ORDER BY data DESC
  `
  return rows.map(toRow)
}

const progressaoSchema = z.object({
  evaluatedUserId: z.string().min(1).max(128),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
  tipo: z.enum(["ADMISSAO", "DISSIDIO", "PROMOCAO", "MERITO", "DESLIGAMENTO"]),
  regime: z.enum(["CLT", "PJ", "COOPERADO", "ESTAGIARIO", "TRAINEE"]),
  cargo: z.string().min(1, "Cargo obrigatório.").max(200),
  valorHora: z.number().int().min(0).max(999_999_900).nullable().optional(),
  valor: z.number().int().min(1, "Valor obrigatório.").max(999_999_900),
})

export async function createProgressao(
  input: z.infer<typeof progressaoSchema>,
): Promise<{ error?: string }> {
  try {
    const session = await requireMgr()
    await ensureIndividualProgressaoTable()
    await ensureIndividualProgressaoCargoColumn()
    await ensureIndividualProgressaoValorHoraColumn()
    const parsed = progressaoSchema.safeParse(input)
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." }

    const { evaluatedUserId, data, tipo, regime, cargo, valorHora, valor } = parsed.data

    const [last] = await prisma.$queryRaw<{ codigo: number }[]>`
      SELECT codigo FROM "IndividualProgressao"
      WHERE "evaluatedUserId" = ${evaluatedUserId}
      ORDER BY codigo DESC
      LIMIT 1
    `
    const codigo = (last?.codigo ?? 0) + 1
    const id = randomUUID()
    const dataTs = new Date(`${data}T12:00:00.000Z`)
    const valorHoraVal = valorHora ?? null

    await prisma.$executeRaw`
      INSERT INTO "IndividualProgressao"
        (id, "evaluatedUserId", "createdByUserId", codigo, data, tipo, regime, cargo, "valorHora", valor, "createdAt", "updatedAt")
      VALUES
        (${id}, ${evaluatedUserId}, ${session.user.id}, ${codigo}, ${dataTs}, ${tipo}, ${regime}, ${cargo}, ${valorHoraVal}, ${valor}, NOW(), NOW())
    `

    // Ensure classificacao columns exist
    await ensureUserClassificacaoColumns()

    // Sync cargo → UserProfile.classificacao (and CreatedUser fallback)
    await prisma.$executeRaw`
      UPDATE "UserProfile" SET "classificacao" = ${cargo}
      WHERE "userId" = ${evaluatedUserId}
    `
    await prisma.$executeRaw`
      UPDATE "CreatedUser" SET "classificacao" = ${cargo}
      WHERE "id" = ${evaluatedUserId}
    `

    try {
      await createNotification(
        evaluatedUserId,
        "PROGRESSION",
        "Nova progressão registrada",
        "Uma progressão de carreira foi registrada para você.",
        `/individual/progressao`,
      )
    } catch (notifErr) {
      if (process.env.NODE_ENV !== "production")
        console.error("[createProgressao] notification trigger:", notifErr)
    }

    return {}
  } catch (err) {
    console.error("[createProgressao] Error:", err)
    return { error: err instanceof Error ? err.message : "Erro interno ao criar progressão." }
  }
}

const updateSchema = progressaoSchema.extend({ id: z.string().min(1).max(128) })

export async function updateProgressao(
  input: z.infer<typeof updateSchema>,
): Promise<{ error?: string }> {
  try {
    await requireMgr()
    await ensureIndividualProgressaoTable()
    await ensureIndividualProgressaoCargoColumn()
    await ensureIndividualProgressaoValorHoraColumn()
    const parsed = updateSchema.safeParse(input)
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." }

    const { id, data, tipo, regime, cargo, valorHora, valor } = parsed.data
    const dataTs = new Date(`${data}T12:00:00.000Z`)
    const valorHoraVal = valorHora ?? null

    await prisma.$executeRaw`
      UPDATE "IndividualProgressao"
      SET data = ${dataTs}, tipo = ${tipo}, regime = ${regime}, cargo = ${cargo}, "valorHora" = ${valorHoraVal}, valor = ${valor}, "updatedAt" = NOW()
      WHERE id = ${id}
    `

    // Sync cargo → classificacao only when this is the most recent progression for the evaluated user
    const [updatedRow] = await prisma.$queryRaw<{ evaluatedUserId: string }[]>`
      SELECT "evaluatedUserId" FROM "IndividualProgressao" WHERE id = ${id} LIMIT 1
    `
    if (updatedRow?.evaluatedUserId) {
      const [mostRecent] = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "IndividualProgressao"
        WHERE "evaluatedUserId" = ${updatedRow.evaluatedUserId}
        ORDER BY data DESC
        LIMIT 1
      `
      if (mostRecent?.id === id) {
        // Ensure classificacao columns exist
        await ensureUserClassificacaoColumns()

        await prisma.$executeRaw`
          UPDATE "UserProfile" SET "classificacao" = ${cargo}
          WHERE "userId" = ${updatedRow.evaluatedUserId}
        `
        await prisma.$executeRaw`
          UPDATE "CreatedUser" SET "classificacao" = ${cargo}
          WHERE "id" = ${updatedRow.evaluatedUserId}
        `
      }
    }

    return {}
  } catch (err) {
    console.error("[updateProgressao] Error:", err)
    return { error: err instanceof Error ? err.message : "Erro interno ao atualizar progressão." }
  }
}

/**
 * MGR: retorna o valorHora (centavos) vigente para cada userId da lista.
 * Usa o registro de progressão mais recente que tenha valorHora não-nulo.
 */
export async function getValorHoraAtualBatch(
  userIds: string[],
): Promise<Record<string, number | null>> {
  await requireMgr()
  if (userIds.length === 0) return {}
  await ensureIndividualProgressaoTable()
  await ensureIndividualProgressaoValorHoraColumn()

  const rows = await prisma.$queryRaw<{ evaluatedUserId: string; valorHora: number | null }[]>`
    SELECT DISTINCT ON ("evaluatedUserId") "evaluatedUserId", "valorHora"
    FROM "IndividualProgressao"
    WHERE "evaluatedUserId" = ANY(${userIds}::text[])
      AND "valorHora" IS NOT NULL
    ORDER BY "evaluatedUserId", data DESC
  `

  const result: Record<string, number | null> = {}
  for (const uid of userIds) result[uid] = null
  for (const row of rows) result[row.evaluatedUserId] = row.valorHora
  return result
}

export interface ProgressaoHistoricoEntry {
  dataYmd: string
  valorHora: number | null
  tipo: string
}

/**
 * MGR: retorna o histórico completo de progressão (data + valorHora) de cada userId.
 * Ordenado por data DESC para que o primeiro elemento seja o mais recente.
 * Permite calcular o valorHora vigente em qualquer mês passado.
 */
export async function getProgressaoHistoricoBatch(
  userIds: string[],
): Promise<Record<string, ProgressaoHistoricoEntry[]>> {
  await requireMgr()
  if (userIds.length === 0) return {}
  await ensureIndividualProgressaoTable()
  await ensureIndividualProgressaoValorHoraColumn()

  const rows = await prisma.$queryRaw<{ evaluatedUserId: string; data: Date; tipo: string; valorHora: number | null }[]>`
    SELECT "evaluatedUserId", data, tipo, "valorHora"
    FROM "IndividualProgressao"
    WHERE "evaluatedUserId" = ANY(${userIds}::text[])
    ORDER BY "evaluatedUserId", data DESC
  `

  const result: Record<string, ProgressaoHistoricoEntry[]> = {}
  for (const uid of userIds) result[uid] = []
  for (const row of rows) {
    result[row.evaluatedUserId]!.push({
      dataYmd: row.data.toISOString().slice(0, 10),
      valorHora: row.valorHora,
      tipo: row.tipo,
    })
  }
  return result
}

export async function deleteProgressao(id: string): Promise<{ error?: string }> {
  try {
    await requireMgr()
    await ensureIndividualProgressaoTable()
    await ensureIndividualProgressaoCargoColumn()
    await ensureIndividualProgressaoValorHoraColumn()
    const parsed = z.string().min(1).max(128).safeParse(id)
    if (!parsed.success) return { error: "ID inválido." }
    await prisma.$executeRaw`
      DELETE FROM "IndividualProgressao" WHERE id = ${parsed.data}
    `
    return {}
  } catch (err) {
    console.error("[deleteProgressao] Error:", err)
    return { error: err instanceof Error ? err.message : "Erro interno ao deletar progressão." }
  }
}
