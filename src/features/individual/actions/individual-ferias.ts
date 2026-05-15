"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { prisma } from "@/core/prisma"
import { ensureIndividualFeriasTable } from "@/core/prisma-schema-ensure"
import { requireSession } from "@/core/session"
import { buildRole, can } from "@/core/rbac/policy"
import { getActiveQaUsers } from "@/features/usuarios/actions/usuarios"

// ── Types ─────────────────────────────────────────────────────────────────────

export interface IndividualFeriasRow {
  id: string
  codigo: number
  inicioIso: string // "YYYY-MM-DD"
  dias: number
  evaluatedUser: { name: string; photoPath: string | null }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const userIdSchema = z.string().min(1).max(128)
const idSchema = z.string().min(1).max(128)

function inicioToIso(d: Date): string {
  return new Date(d).toISOString().slice(0, 10)
}

function assertFeriasModelReady(): void {
  const model = (prisma as unknown as Record<string, unknown>)["individualFerias"]
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
    return "Tabela de férias ainda não existe. Recarregue a página ou rode as migrações Prisma."
  }
  if (/desatualizado|prisma generate/i.test(msg)) return msg
  return fallback
}

// ── Auth helpers ──────────────────────────────────────────────────────────────

/** Requer MGR Administrador para operações de escrita. */
async function requireMgrFeriasAccess() {
  const session = await requireSession()
  const role = buildRole(session.user.type, session.user.accessProfile)
  if (!can(role, "individual.viewOthers")) throw new Error("Não autorizado.")
  if (session.user.type !== "Administrador") throw new Error("Não autorizado.")
  return { session }
}

/**
 * Para leitura: aceita MGR Administrador (viewOthers) ou o próprio usuário
 * consultando as suas próprias férias.
 */
async function requireViewFeriasAccess(evaluatedUserId: string): Promise<void> {
  const session = await requireSession()
  const role = buildRole(session.user.type, session.user.accessProfile)
  if (can(role, "individual.viewOthers")) return
  if (session.user.id === evaluatedUserId) return
  throw new Error("Não autorizado.")
}

async function assertEvaluatedUserInScope(evaluatedUserId: string): Promise<void> {
  const r = userIdSchema.safeParse(evaluatedUserId)
  if (!r.success) throw new Error("Usuário inválido.")
  const users = await getActiveQaUsers()
  if (!users.some((u) => u.id === evaluatedUserId)) throw new Error("Usuário não encontrado ou inativo.")
}

// ── Server actions ────────────────────────────────────────────────────────────

export async function listIndividualFerias(
  evaluatedUserId: string,
): Promise<IndividualFeriasRow[]> {
  await requireViewFeriasAccess(evaluatedUserId)
  const r = userIdSchema.safeParse(evaluatedUserId)
  if (!r.success) throw new Error("Usuário inválido.")
  await ensureIndividualFeriasTable()
  assertFeriasModelReady()

  try {
    const [rows, allUsers] = await Promise.all([
      prisma.individualFerias.findMany({
        where: { evaluatedUserId },
        orderBy: [{ inicio: "desc" }],
        select: { id: true, codigo: true, inicio: true, dias: true },
      }) as Promise<{ id: string; codigo: number; inicio: Date; dias: number }[]>,
      getActiveQaUsers(),
    ])

    const user = allUsers.find((u) => u.id === evaluatedUserId)
    const evaluatedUser = { name: user?.name ?? "Usuário", photoPath: user?.photoPath ?? null }

    return rows.map((row) => ({
      id: row.id,
      codigo: row.codigo,
      inicioIso: inicioToIso(row.inicio),
      dias: row.dias,
      evaluatedUser,
    }))
  } catch (e) {
    console.error("[listIndividualFerias]", e)
    throw new Error(evalPrismaMessage(e, "Não foi possível carregar as férias."))
  }
}

export async function listAllFerias(): Promise<IndividualFeriasRow[]> {
  const session = await requireSession()
  if (!session) throw new Error("Não autorizado.")
  await ensureIndividualFeriasTable()
  assertFeriasModelReady()

  try {
    const [rows, allUsers] = await Promise.all([
      prisma.individualFerias.findMany({
        orderBy: [{ inicio: "desc" }],
        select: { id: true, codigo: true, inicio: true, dias: true, evaluatedUserId: true },
      }) as Promise<{ id: string; codigo: number; inicio: Date; dias: number; evaluatedUserId: string }[]>,
      getActiveQaUsers(),
    ])

    return rows.map((row) => {
      const user = allUsers.find((u) => u.id === row.evaluatedUserId)
      const evaluatedUser = { name: user?.name ?? "Usuário", photoPath: user?.photoPath ?? null }
      return {
        id: row.id,
        codigo: row.codigo,
        inicioIso: inicioToIso(row.inicio),
        dias: row.dias,
        evaluatedUser,
      }
    })
  } catch (e) {
    console.error("[listAllFerias]", e)
    throw new Error(evalPrismaMessage(e, "Não foi possível carregar as férias."))
  }
}

export async function createIndividualFerias(input: {
  evaluatedUserId: string
  inicioIso: string
  dias: number
}): Promise<{ id: string } | { error: string }> {
  try {
    const { session } = await requireMgrFeriasAccess()
    await assertEvaluatedUserInScope(input.evaluatedUserId)

    const inicioDate = new Date(input.inicioIso + "T00:00:00Z")
    if (isNaN(inicioDate.getTime())) return { error: "Data de início inválida." }

    const diasR = z.number().int().min(1).safeParse(input.dias)
    if (!diasR.success) return { error: "Dias de férias inválidos (mínimo 1)." }

    await ensureIndividualFeriasTable()
    assertFeriasModelReady()

    const existing = (await prisma.individualFerias.findMany({
      where: { evaluatedUserId: input.evaluatedUserId },
      select: { codigo: true },
      orderBy: { codigo: "desc" },
    })) as { codigo: number }[]
    const nextCodigo = existing.length > 0 ? (existing[0]?.codigo ?? 0) + 1 : 1

    const row = (await prisma.individualFerias.create({
      data: {
        evaluatedUserId: input.evaluatedUserId,
        createdByUserId: session.user.id,
        codigo: nextCodigo,
        inicio: inicioDate,
        dias: diasR.data,
      },
      select: { id: true },
    })) as { id: string }

    revalidatePath(`/individual/ferias`)
    return { id: row.id }
  } catch (e) {
    console.error("[createIndividualFerias]", e)
    if (e instanceof Error) return { error: e.message }
    return { error: "Não foi possível salvar as férias." }
  }
}

export async function updateIndividualFerias(input: {
  id: string
  inicioIso: string
  dias: number
}): Promise<{ error?: string }> {
  try {
    await requireMgrFeriasAccess()
    const idR = idSchema.safeParse(input.id)
    if (!idR.success) return { error: "ID inválido." }

    const inicioDate = new Date(input.inicioIso + "T00:00:00Z")
    if (isNaN(inicioDate.getTime())) return { error: "Data de início inválida." }

    const diasR = z.number().int().min(1).safeParse(input.dias)
    if (!diasR.success) return { error: "Dias de férias inválidos (mínimo 1)." }

    await ensureIndividualFeriasTable()
    assertFeriasModelReady()

    const existing = (await prisma.individualFerias.findUnique({
      where: { id: idR.data },
      select: { id: true },
    })) as { id: string } | null
    if (!existing) return { error: "Registro de férias não encontrado." }

    await prisma.individualFerias.update({
      where: { id: idR.data },
      data: { inicio: inicioDate, dias: diasR.data, updatedAt: new Date() },
    })

    revalidatePath(`/individual/ferias`)
    return {}
  } catch (e) {
    console.error("[updateIndividualFerias]", e)
    if (e instanceof Error) return { error: e.message }
    return { error: "Não foi possível salvar as férias." }
  }
}

export async function deleteIndividualFerias(id: string): Promise<{ error?: string }> {
  try {
    await requireMgrFeriasAccess()
    const idR = idSchema.safeParse(id)
    if (!idR.success) return { error: "ID inválido." }

    await ensureIndividualFeriasTable()
    assertFeriasModelReady()

    const existing = (await prisma.individualFerias.findUnique({
      where: { id: idR.data },
      select: { id: true },
    })) as { id: string } | null
    if (!existing) return { error: "Registro de férias não encontrado." }

    await prisma.individualFerias.delete({ where: { id: idR.data } })
    revalidatePath(`/individual/ferias`)
    return {}
  } catch (e) {
    console.error("[deleteIndividualFerias]", e)
    if (e instanceof Error) return { error: e.message }
    return { error: "Não foi possível remover as férias." }
  }
}
