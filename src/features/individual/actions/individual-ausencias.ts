"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { prisma } from "@/core/prisma"
import { ensureIndividualAusenciasTable } from "@/core/prisma-schema-ensure"
import { requireSession } from "@/core/session"
import { buildRole, can } from "@/core/rbac/policy"
import { getActiveQaUsers } from "@/features/usuarios/actions/usuarios"
import {
  createAusenciaSchema,
  updateAusenciaSchema,
  refuseAusenciaSchema,
} from "@/features/individual/lib/individual-ausencias-schemas"

// ── Types ─────────────────────────────────────────────────────────────────────

export type AusenciaTipo = "FALTA" | "BANCO_HORAS" | "ATESTADO" | "ATRASO" | "OUTRO"
export type AusenciaSituacao = "PENDENTE" | "APROVADA" | "RECUSADA"

export interface IndividualAusenciasRow {
  id: string
  codigo: number
  tipo: AusenciaTipo
  dataInicioIso: string // "YYYY-MM-DD"
  dataFimIso: string    // "YYYY-MM-DD"
  justificativa: string
  situacao: AusenciaSituacao
  motivoRecusa: string | null
  aprovadoPorId: string | null
  createdAt: string
  evaluatedUser: { name: string; photoPath: string | null }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const idSchema = z.string().min(1).max(128)

function dataToIso(d: Date): string {
  return new Date(d).toISOString().slice(0, 10)
}

function formatDataPtBr(isoDate: string): string {
  const [year, month, day] = isoDate.split("-")
  return `${day}/${month}/${year}`
}

function tipoLabel(tipo: AusenciaTipo): string {
  const map: Record<AusenciaTipo, string> = {
    FALTA: "Falta",
    BANCO_HORAS: "Banco de horas",
    ATESTADO: "Atestado",
    ATRASO: "Atraso",
    OUTRO: "Outro",
  }
  return map[tipo]
}

function assertAusenciasModelReady(): void {
  const model = (prisma as unknown as Record<string, unknown>)["individualAusencias"]
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
    return "Tabela de ausências ainda não existe. Recarregue a página ou rode as migrações Prisma."
  }
  if (/desatualizado|prisma generate/i.test(msg)) return msg
  return fallback
}

// ── Auth helpers ──────────────────────────────────────────────────────────────

async function requireMgrAccess() {
  const session = await requireSession()
  const role = buildRole(session.user.type, session.user.accessProfile)
  if (!can(role, "individual.viewOthers")) throw new Error("Não autorizado.")
  return { session }
}

async function requireViewAusenciaAccess(evaluatedUserId: string): Promise<{ canViewOthers: boolean }> {
  const session = await requireSession()
  const role = buildRole(session.user.type, session.user.accessProfile)
  const canViewOthers = can(role, "individual.viewOthers")
  if (canViewOthers) return { canViewOthers: true }
  if (session.user.id === evaluatedUserId) return { canViewOthers: false }
  throw new Error("Não autorizado.")
}

// ── Server Actions ─────────────────────────────────────────────────────────────

export async function listIndividualAusencias(
  evaluatedUserId: string,
): Promise<IndividualAusenciasRow[]> {
  try {
    const idR = idSchema.safeParse(evaluatedUserId)
    if (!idR.success) return []

    const { canViewOthers } = await requireViewAusenciaAccess(evaluatedUserId)

    await ensureIndividualAusenciasTable()
    assertAusenciasModelReady()

    const [rows, allUsers] = await Promise.all([
      (prisma.individualAusencias.findMany as (...args: unknown[]) => Promise<unknown>)({
        where: {
          evaluatedUserId,
          ...(canViewOthers ? {} : { situacao: { in: ["APROVADA", "RECUSADA"] } }),
        },
        orderBy: [{ createdAt: "desc" }],
        select: {
          id: true,
          codigo: true,
          tipo: true,
          dataInicio: true,
          dataFim: true,
          justificativa: true,
          situacao: true,
          motivoRecusa: true,
          aprovadoPorId: true,
          createdAt: true,
        },
      }) as Promise<{
        id: string
        codigo: number
        tipo: AusenciaTipo
        dataInicio: Date
        dataFim: Date
        justificativa: string
        situacao: AusenciaSituacao
        motivoRecusa: string | null
        aprovadoPorId: string | null
        createdAt: Date
      }[]>,
      getActiveQaUsers(),
    ])

    const user = allUsers.find((u) => u.id === evaluatedUserId)
    const evaluatedUser = { name: user?.name ?? "Usuário", photoPath: user?.photoPath ?? null }

    return rows.map((row) => ({
      id: row.id,
      codigo: row.codigo,
      tipo: row.tipo,
      dataInicioIso: dataToIso(row.dataInicio),
      dataFimIso: dataToIso(row.dataFim),
      justificativa: row.justificativa,
      situacao: row.situacao,
      motivoRecusa: row.motivoRecusa,
      aprovadoPorId: row.aprovadoPorId,
      createdAt: row.createdAt.toISOString(),
      evaluatedUser,
    }))
  } catch (e) {
    console.error("[listIndividualAusencias]", e)
    return []
  }
}

export async function listAllAusenciasAprovadas(): Promise<IndividualAusenciasRow[]> {
  try {
    await requireSession()
    await ensureIndividualAusenciasTable()
    assertAusenciasModelReady()

    const [rows, allUsers] = await Promise.all([
      (prisma.individualAusencias.findMany as (...args: unknown[]) => Promise<unknown>)({
        where: { situacao: "APROVADA" },
        orderBy: [{ dataInicio: "desc" }],
        select: {
          id: true,
          codigo: true,
          evaluatedUserId: true,
          tipo: true,
          dataInicio: true,
          dataFim: true,
          justificativa: true,
          createdAt: true,
        },
      }) as Promise<{
        id: string
        codigo: number
        evaluatedUserId: string
        tipo: AusenciaTipo
        dataInicio: Date
        dataFim: Date
        justificativa: string
        createdAt: Date
      }[]>,
      getActiveQaUsers(),
    ])

    const activeUserIds = new Set(allUsers.map((u) => u.id))
    return rows
      .filter((row) => activeUserIds.has(row.evaluatedUserId))
      .map((row) => {
        const user = allUsers.find((u) => u.id === row.evaluatedUserId)!
        const evaluatedUser = { name: user.name, photoPath: user.photoPath ?? null }
        return {
          id: row.id,
          codigo: row.codigo,
          tipo: row.tipo,
          dataInicioIso: dataToIso(row.dataInicio),
          dataFimIso: dataToIso(row.dataFim),
          justificativa: row.justificativa,
          situacao: "APROVADA" as AusenciaSituacao,
          motivoRecusa: null,
          aprovadoPorId: null,
          createdAt: row.createdAt.toISOString(),
          evaluatedUser,
        }
      })
  } catch (e) {
    console.error("[listAllAusenciasAprovadas]", e)
    return []
  }
}

export async function createIndividualAusencias(
  input: unknown,
): Promise<{ id: string } | { error: string }> {
  try {
    const session = await requireSession()

    const parsed = createAusenciaSchema.safeParse(input)
    if (!parsed.success) {
      const firstError = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0]
      return { error: firstError ?? "Dados inválidos." }
    }

    const data = parsed.data

    // Verificar que o usuário só pode criar ausência para si mesmo,
    // a menos que seja Administrador:MGR com acesso a viewOthers.
    const role = buildRole(session.user.type, session.user.accessProfile)
    const canViewOthers = can(role, "individual.viewOthers")
    if (!canViewOthers && data.evaluatedUserId !== session.user.id) {
      return { error: "Não autorizado." }
    }

    const dataInicioDate = new Date(data.dataInicioIso + "T00:00:00Z")
    const dataFimDate = new Date(data.dataFimIso + "T00:00:00Z")
    if (isNaN(dataInicioDate.getTime())) return { error: "Data de início inválida." }
    if (isNaN(dataFimDate.getTime())) return { error: "Data de término inválida." }

    await ensureIndividualAusenciasTable()
    assertAusenciasModelReady()

    const existing = (await (prisma.individualAusencias.findMany as (...args: unknown[]) => Promise<unknown>)({
      where: { evaluatedUserId: data.evaluatedUserId },
      select: { codigo: true },
      orderBy: { codigo: "desc" },
      take: 1,
    })) as { codigo: number }[]
    const nextCodigo = existing.length > 0 ? (existing[0]?.codigo ?? 0) + 1 : 1

    const isMgr = role === "Administrador:MGR"
    const row = (await (prisma.individualAusencias.create as (...args: unknown[]) => Promise<unknown>)({
      data: {
        evaluatedUserId: data.evaluatedUserId,
        createdByUserId: session.user.id,
        codigo: nextCodigo,
        tipo: data.tipo,
        dataInicio: dataInicioDate,
        dataFim: dataFimDate,
        justificativa: data.justificativa,
        situacao: isMgr ? "APROVADA" : "PENDENTE",
      },
      select: { id: true },
    })) as { id: string }

    revalidatePath("/individual/ausencias")
    return { id: row.id }
  } catch (e) {
    console.error("[createIndividualAusencias]", e)
    if (e instanceof Error) return { error: e.message }
    return { error: "Não foi possível registrar a ausência." }
  }
}

export async function approveIndividualAusencias(
  id: string,
): Promise<{ error?: string }> {
  try {
    const { session } = await requireMgrAccess()

    const idR = idSchema.safeParse(id)
    if (!idR.success) return { error: "ID inválido." }

    await ensureIndividualAusenciasTable()
    assertAusenciasModelReady()

    const existing = (await (prisma.individualAusencias.findUnique as (...args: unknown[]) => Promise<unknown>)({
      where: { id: idR.data },
      select: { id: true, situacao: true },
    })) as { id: string; situacao: AusenciaSituacao } | null
    if (!existing) return { error: "Ausência não encontrada." }
    if (existing.situacao !== "PENDENTE") return { error: "Esta ausência já foi processada." }

    await (prisma.individualAusencias.update as (...args: unknown[]) => Promise<unknown>)({
      where: { id: idR.data },
      data: {
        situacao: "APROVADA",
        aprovadoPorId: session.user.id,
        updatedAt: new Date(),
      },
    })

    revalidatePath("/individual/ausencias")
    revalidatePath("/equipe/ausencias")
    return {}
  } catch (e) {
    console.error("[approveIndividualAusencias]", e)
    if (e instanceof Error) return { error: e.message }
    return { error: "Não foi possível aprovar a ausência." }
  }
}

export async function refuseIndividualAusencias(
  input: unknown,
): Promise<{ error?: string }> {
  try {
    const { session } = await requireMgrAccess()

    const parsed = refuseAusenciaSchema.safeParse(input)
    if (!parsed.success) {
      const firstError = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0]
      return { error: firstError ?? "Dados inválidos." }
    }

    const { id, motivoRecusa } = parsed.data

    await ensureIndividualAusenciasTable()
    assertAusenciasModelReady()

    const existing = (await (prisma.individualAusencias.findUnique as (...args: unknown[]) => Promise<unknown>)({
      where: { id },
      select: { id: true, situacao: true, evaluatedUserId: true, tipo: true },
    })) as {
      id: string
      situacao: AusenciaSituacao
      evaluatedUserId: string
      tipo: AusenciaTipo
    } | null
    if (!existing) return { error: "Ausência não encontrada." }
    if (existing.situacao !== "PENDENTE") return { error: "Esta ausência já foi processada." }

    await (prisma.individualAusencias.update as (...args: unknown[]) => Promise<unknown>)({
      where: { id },
      data: {
        situacao: "RECUSADA",
        motivoRecusa,
        aprovadoPorId: session.user.id,
        updatedAt: new Date(),
      },
    })

    revalidatePath("/individual/ausencias")
    return {}
  } catch (e) {
    console.error("[refuseIndividualAusencias]", e)
    if (e instanceof Error) return { error: e.message }
    return { error: "Não foi possível recusar a ausência." }
  }
}

export async function updateIndividualAusencias(
  input: unknown,
): Promise<{ error?: string }> {
  try {
    await requireMgrAccess()

    const parsed = updateAusenciaSchema.safeParse(input)
    if (!parsed.success) {
      const firstError = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0]
      return { error: firstError ?? "Dados inválidos." }
    }

    const data = parsed.data
    const dataInicioDate = new Date(data.dataInicioIso + "T00:00:00Z")
    const dataFimDate = new Date(data.dataFimIso + "T00:00:00Z")
    if (isNaN(dataInicioDate.getTime())) return { error: "Data de início inválida." }
    if (isNaN(dataFimDate.getTime())) return { error: "Data de término inválida." }

    await ensureIndividualAusenciasTable()
    assertAusenciasModelReady()

    const existing = (await (prisma.individualAusencias.findUnique as (...args: unknown[]) => Promise<unknown>)({
      where: { id: data.id },
      select: { id: true },
    })) as { id: string } | null
    if (!existing) return { error: "Ausência não encontrada." }

    await (prisma.individualAusencias.update as (...args: unknown[]) => Promise<unknown>)({
      where: { id: data.id },
      data: {
        tipo: data.tipo,
        dataInicio: dataInicioDate,
        dataFim: dataFimDate,
        justificativa: data.justificativa,
        updatedAt: new Date(),
      },
    })

    revalidatePath("/individual/ausencias")
    return {}
  } catch (e) {
    console.error("[updateIndividualAusencias]", e)
    if (e instanceof Error) return { error: e.message }
    return { error: "Não foi possível atualizar a ausência." }
  }
}

export async function deleteIndividualAusencias(
  id: string,
): Promise<{ error?: string }> {
  try {
    await requireMgrAccess()

    const idR = idSchema.safeParse(id)
    if (!idR.success) return { error: "ID inválido." }

    await ensureIndividualAusenciasTable()
    assertAusenciasModelReady()

    const existing = (await (prisma.individualAusencias.findUnique as (...args: unknown[]) => Promise<unknown>)({
      where: { id: idR.data },
      select: { id: true },
    })) as { id: string } | null
    if (!existing) return { error: "Ausência não encontrada." }

    await (prisma.individualAusencias.delete as (...args: unknown[]) => Promise<unknown>)({ where: { id: idR.data } })

    revalidatePath("/individual/ausencias")
    revalidatePath("/equipe/ausencias")
    return {}
  } catch (e) {
    console.error("[deleteIndividualAusencias]", e)
    if (e instanceof Error) return { error: e.message }
    return { error: "Não foi possível remover a ausência." }
  }
}
