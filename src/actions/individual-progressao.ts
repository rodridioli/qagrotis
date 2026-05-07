"use server"

import { z } from "zod"
import { prisma } from "@/lib/prisma"
import {
  ensureIndividualProgressaoTable,
  ensureIndividualProgressaoCargoColumn,
  ensureUserClassificacaoColumns,
} from "@/lib/prisma-schema-ensure"
import { requireSession } from "@/lib/session"
import { buildRole, can } from "@/lib/rbac/policy"
import type { ProgressaoListRow } from "@/lib/individual-progressao"

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
    valor: p.valor,
  }
}

/** MGR: lista progressões de um usuário específico. */
export async function listProgressoes(evaluatedUserId: string): Promise<ProgressaoListRow[]> {
  await requireMgr()
  await ensureIndividualProgressaoTable()
  await ensureIndividualProgressaoCargoColumn()
  const parsed = z.string().min(1).max(128).safeParse(evaluatedUserId)
  if (!parsed.success) throw new Error("ID de usuário inválido.")
  const rows = await prisma.$queryRaw<RawRow[]>`
    SELECT id, codigo, data, tipo, regime, cargo, valor
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
  const rows = await prisma.$queryRaw<RawRow[]>`
    SELECT id, codigo, data, tipo, regime, cargo, valor
    FROM "IndividualProgressao"
    WHERE "evaluatedUserId" = ${session.user.id}
    ORDER BY data DESC
  `
  return rows.map(toRow)
}

const progressaoSchema = z.object({
  evaluatedUserId: z.string().min(1).max(128),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
  tipo: z.enum(["ADMISSAO", "DISSIDIO", "PROMOCAO", "MERITO"]),
  regime: z.enum(["CLT", "PJ", "COOPERADO"]),
  cargo: z.string().min(1, "Cargo obrigatório.").max(200),
  valor: z.number().int().min(1, "Valor obrigatório.").max(999_999_900),
})

export async function createProgressao(
  input: z.infer<typeof progressaoSchema>,
): Promise<{ error?: string }> {
  const session = await requireMgr()
  await ensureIndividualProgressaoTable()
  await ensureIndividualProgressaoCargoColumn()
  const parsed = progressaoSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." }

  const { evaluatedUserId, data, tipo, regime, cargo, valor } = parsed.data

  const [last] = await prisma.$queryRaw<{ codigo: number }[]>`
    SELECT codigo FROM "IndividualProgressao"
    WHERE "evaluatedUserId" = ${evaluatedUserId}
    ORDER BY codigo DESC
    LIMIT 1
  `
  const codigo = (last?.codigo ?? 0) + 1
  const id = crypto.randomUUID()
  const dataTs = new Date(`${data}T12:00:00.000Z`)

  await prisma.$executeRaw`
    INSERT INTO "IndividualProgressao"
      (id, "evaluatedUserId", "createdByUserId", codigo, data, tipo, regime, cargo, valor, "createdAt", "updatedAt")
    VALUES
      (${id}, ${evaluatedUserId}, ${session.user.id}, ${codigo}, ${dataTs}, ${tipo}, ${regime}, ${cargo}, ${valor}, NOW(), NOW())
  `

  // Ensure classificacao columns exist
  await ensureUserClassificacaoColumns()

  // Sync cargo → UserProfile.classificacao (and CreatedUser fallback)
  await prisma.$executeRaw`
    UPDATE "UserProfile" SET "classificacao" = ${cargo}, "updatedAt" = NOW()
    WHERE "userId" = ${evaluatedUserId}
  `
  await prisma.$executeRaw`
    UPDATE "CreatedUser" SET "classificacao" = ${cargo}
    WHERE "id" = ${evaluatedUserId}
  `

  return {}
}

const updateSchema = progressaoSchema.extend({ id: z.string().min(1).max(128) })

export async function updateProgressao(
  input: z.infer<typeof updateSchema>,
): Promise<{ error?: string }> {
  await requireMgr()
  await ensureIndividualProgressaoTable()
  await ensureIndividualProgressaoCargoColumn()
  const parsed = updateSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." }

  const { id, data, tipo, regime, cargo, valor } = parsed.data
  const dataTs = new Date(`${data}T12:00:00.000Z`)

  await prisma.$executeRaw`
    UPDATE "IndividualProgressao"
    SET data = ${dataTs}, tipo = ${tipo}, regime = ${regime}, cargo = ${cargo}, valor = ${valor}, "updatedAt" = NOW()
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
        UPDATE "UserProfile" SET "classificacao" = ${cargo}, "updatedAt" = NOW()
        WHERE "userId" = ${updatedRow.evaluatedUserId}
      `
      await prisma.$executeRaw`
        UPDATE "CreatedUser" SET "classificacao" = ${cargo}
        WHERE "id" = ${updatedRow.evaluatedUserId}
      `
    }
  }

  return {}
}

export async function deleteProgressao(id: string): Promise<{ error?: string }> {
  await requireMgr()
  await ensureIndividualProgressaoTable()
  await ensureIndividualProgressaoCargoColumn()
  const parsed = z.string().min(1).max(128).safeParse(id)
  if (!parsed.success) return { error: "ID inválido." }
  await prisma.$executeRaw`
    DELETE FROM "IndividualProgressao" WHERE id = ${parsed.data}
  `
  return {}
}
