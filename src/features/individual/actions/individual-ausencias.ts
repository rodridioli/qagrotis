"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { prisma } from "@/core/prisma"
import { ensureIndividualAusenciasTable } from "@/core/prisma-schema-ensure"
import { requireSession } from "@/core/session"
import { buildRole, can } from "@/core/rbac/policy"
import { createNotification } from "@/core/actions/notifications"
import { getActiveQaUsers } from "@/features/usuarios/actions/usuarios"

// ── Types ─────────────────────────────────────────────────────────────────────

export type AusenciaTipo = "FALTA" | "BANCO_HORAS" | "ATESTADO" | "OUTRO"
export type AusenciaSituacao = "PENDENTE" | "APROVADA" | "RECUSADA"

export interface IndividualAusenciasRow {
  id: string
  codigo: number
  tipo: AusenciaTipo
  dataIso: string // "YYYY-MM-DD"
  diaInteiro: boolean
  horaInicio: string | null
  horaFim: string | null
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

// ── Zod Schemas (exported for front-end reuse) ────────────────────────────────

const horaRegex = /^([01]\d|2[0-3]):([0-5]\d)$/

function horaToMinutes(hora: string): number {
  const [h, m] = hora.split(":").map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

export const createAusenciaSchema = z
  .object({
    evaluatedUserId: z.string().min(1).max(128),
    tipo: z.enum(["FALTA", "BANCO_HORAS", "ATESTADO", "OUTRO"]),
    dataIso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
    diaInteiro: z.boolean(),
    horaInicio: z
      .string()
      .regex(horaRegex, "Formato inválido (HH:MM).")
      .nullable()
      .optional(),
    horaFim: z
      .string()
      .regex(horaRegex, "Formato inválido (HH:MM).")
      .nullable()
      .optional(),
    justificativa: z.string().min(1, "Este campo é obrigatório.").max(2000),
  })
  .superRefine((val, ctx) => {
    if (!val.diaInteiro) {
      if (!val.horaInicio) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Este campo é obrigatório.",
          path: ["horaInicio"],
        })
      }
      if (!val.horaFim) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Este campo é obrigatório.",
          path: ["horaFim"],
        })
      }
      if (val.horaInicio && val.horaFim) {
        if (horaToMinutes(val.horaFim) <= horaToMinutes(val.horaInicio)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Hora de término deve ser após a hora de início.",
            path: ["horaFim"],
          })
        }
      }
    }
  })

export const updateAusenciaSchema = z
  .object({
    id: z.string().min(1).max(128),
    tipo: z.enum(["FALTA", "BANCO_HORAS", "ATESTADO", "OUTRO"]),
    dataIso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
    diaInteiro: z.boolean(),
    horaInicio: z
      .string()
      .regex(horaRegex, "Formato inválido (HH:MM).")
      .nullable()
      .optional(),
    horaFim: z
      .string()
      .regex(horaRegex, "Formato inválido (HH:MM).")
      .nullable()
      .optional(),
    justificativa: z.string().min(1, "Este campo é obrigatório.").max(2000),
  })
  .superRefine((val, ctx) => {
    if (!val.diaInteiro) {
      if (!val.horaInicio) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Este campo é obrigatório.",
          path: ["horaInicio"],
        })
      }
      if (!val.horaFim) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Este campo é obrigatório.",
          path: ["horaFim"],
        })
      }
      if (val.horaInicio && val.horaFim) {
        if (horaToMinutes(val.horaFim) <= horaToMinutes(val.horaInicio)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Hora de término deve ser após a hora de início.",
            path: ["horaFim"],
          })
        }
      }
    }
  })

export const refuseAusenciaSchema = z.object({
  id: z.string().min(1).max(128),
  motivoRecusa: z.string().min(1, "Este campo é obrigatório.").max(2000),
})

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
  const idR = idSchema.safeParse(evaluatedUserId)
  if (!idR.success) throw new Error("Usuário inválido.")

  const { canViewOthers } = await requireViewAusenciaAccess(evaluatedUserId)

  await ensureIndividualAusenciasTable()

  try {
    assertAusenciasModelReady()
    const [rows, allUsers] = await Promise.all([
      (prisma.individualAusencias.findMany as Function)({
        where: {
          evaluatedUserId,
          ...(canViewOthers ? {} : { situacao: { in: ["APROVADA", "RECUSADA"] } }),
        },
        orderBy: [{ createdAt: "desc" }],
        select: {
          id: true,
          codigo: true,
          tipo: true,
          data: true,
          diaInteiro: true,
          horaInicio: true,
          horaFim: true,
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
        data: Date
        diaInteiro: boolean
        horaInicio: string | null
        horaFim: string | null
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
      dataIso: dataToIso(row.data),
      diaInteiro: row.diaInteiro,
      horaInicio: row.horaInicio,
      horaFim: row.horaFim,
      justificativa: row.justificativa,
      situacao: row.situacao,
      motivoRecusa: row.motivoRecusa,
      aprovadoPorId: row.aprovadoPorId,
      createdAt: row.createdAt.toISOString(),
      evaluatedUser,
    }))
  } catch (e) {
    console.error("[listIndividualAusencias]", e)
    throw new Error(evalPrismaMessage(e, "Não foi possível carregar as ausências."))
  }
}

export async function listAllAusenciasAprovadas(): Promise<IndividualAusenciasRow[]> {
  const session = await requireSession()
  if (!session) throw new Error("Não autorizado.")

  await ensureIndividualAusenciasTable()

  try {
    assertAusenciasModelReady()
    const [rows, allUsers] = await Promise.all([
      (prisma.individualAusencias.findMany as Function)({
        where: { situacao: "APROVADA" },
        orderBy: [{ data: "desc" }],
        select: {
          id: true,
          codigo: true,
          evaluatedUserId: true,
          tipo: true,
          data: true,
          diaInteiro: true,
          horaInicio: true,
          horaFim: true,
          justificativa: true,
          createdAt: true,
        },
      }) as Promise<{
        id: string
        codigo: number
        evaluatedUserId: string
        tipo: AusenciaTipo
        data: Date
        diaInteiro: boolean
        horaInicio: string | null
        horaFim: string | null
        justificativa: string
        createdAt: Date
      }[]>,
      getActiveQaUsers(),
    ])

    return rows.map((row) => {
      const user = allUsers.find((u) => u.id === row.evaluatedUserId)
      const evaluatedUser = { name: user?.name ?? "Usuário", photoPath: user?.photoPath ?? null }
      return {
        id: row.id,
        codigo: row.codigo,
        tipo: row.tipo,
        dataIso: dataToIso(row.data),
        diaInteiro: row.diaInteiro,
        horaInicio: row.horaInicio,
        horaFim: row.horaFim,
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
    throw new Error(evalPrismaMessage(e, "Não foi possível carregar as ausências."))
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

    const dataDate = new Date(data.dataIso + "T00:00:00Z")
    if (isNaN(dataDate.getTime())) return { error: "Data inválida." }

    await ensureIndividualAusenciasTable()
    assertAusenciasModelReady()

    const existing = (await (prisma.individualAusencias.findMany as Function)({
      where: { evaluatedUserId: data.evaluatedUserId },
      select: { codigo: true },
      orderBy: { codigo: "desc" },
      take: 1,
    })) as { codigo: number }[]
    const nextCodigo = existing.length > 0 ? (existing[0]?.codigo ?? 0) + 1 : 1

    const row = (await (prisma.individualAusencias.create as Function)({
      data: {
        evaluatedUserId: data.evaluatedUserId,
        createdByUserId: session.user.id,
        codigo: nextCodigo,
        tipo: data.tipo,
        data: dataDate,
        diaInteiro: data.diaInteiro,
        horaInicio: data.diaInteiro ? null : (data.horaInicio ?? null),
        horaFim: data.diaInteiro ? null : (data.horaFim ?? null),
        justificativa: data.justificativa,
        situacao: "PENDENTE",
      },
      select: { id: true },
    })) as { id: string }

    // Notify all Administrador:MGR users
    try {
      const mgrUsers = await prisma.createdUser.findMany({
        where: { type: "Administrador", accessProfile: "MGR" },
        select: { id: true },
      })
      const solicitanteUser = await prisma.createdUser.findUnique({
        where: { id: session.user.id },
        select: { name: true },
      })
      const nomesSolicitante = solicitanteUser?.name ?? session.user.name ?? "Usuário"
      const dataFormatada = formatDataPtBr(data.dataIso)
      const tipoFormatado = tipoLabel(data.tipo)

      await Promise.all(
        mgrUsers.map((mgr) =>
          createNotification(
            mgr.id,
            "ABSENCE_REQUEST",
            "Nova solicitação de ausência",
            `${nomesSolicitante} solicitou ausência do tipo ${tipoFormatado} em ${dataFormatada}.`,
            null,
          ),
        ),
      )
    } catch (notifErr) {
      console.error("[createIndividualAusencias] falha ao notificar MGRs:", notifErr)
    }

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

    const existing = (await (prisma.individualAusencias.findUnique as Function)({
      where: { id: idR.data },
      select: { id: true, situacao: true },
    })) as { id: string; situacao: AusenciaSituacao } | null
    if (!existing) return { error: "Ausência não encontrada." }
    if (existing.situacao !== "PENDENTE") return { error: "Esta ausência já foi processada." }

    await (prisma.individualAusencias.update as Function)({
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

    const existing = (await (prisma.individualAusencias.findUnique as Function)({
      where: { id },
      select: { id: true, situacao: true, evaluatedUserId: true, tipo: true, data: true },
    })) as {
      id: string
      situacao: AusenciaSituacao
      evaluatedUserId: string
      tipo: AusenciaTipo
      data: Date
    } | null
    if (!existing) return { error: "Ausência não encontrada." }
    if (existing.situacao !== "PENDENTE") return { error: "Esta ausência já foi processada." }

    await (prisma.individualAusencias.update as Function)({
      where: { id },
      data: {
        situacao: "RECUSADA",
        motivoRecusa,
        aprovadoPorId: session.user.id,
        updatedAt: new Date(),
      },
    })

    // Notify the requesting user
    try {
      const dataFormatada = formatDataPtBr(dataToIso(existing.data))
      const tipoFormatado = tipoLabel(existing.tipo)
      await createNotification(
        existing.evaluatedUserId,
        "ABSENCE_REQUEST",
        "Solicitação de ausência recusada",
        `Sua solicitação de ${tipoFormatado} em ${dataFormatada} foi recusada. Motivo: ${motivoRecusa}`,
        null,
      )
    } catch (notifErr) {
      console.error("[refuseIndividualAusencias] falha ao notificar usuário:", notifErr)
    }

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
    const dataDate = new Date(data.dataIso + "T00:00:00Z")
    if (isNaN(dataDate.getTime())) return { error: "Data inválida." }

    await ensureIndividualAusenciasTable()
    assertAusenciasModelReady()

    const existing = (await (prisma.individualAusencias.findUnique as Function)({
      where: { id: data.id },
      select: { id: true },
    })) as { id: string } | null
    if (!existing) return { error: "Ausência não encontrada." }

    await (prisma.individualAusencias.update as Function)({
      where: { id: data.id },
      data: {
        tipo: data.tipo,
        data: dataDate,
        diaInteiro: data.diaInteiro,
        horaInicio: data.diaInteiro ? null : (data.horaInicio ?? null),
        horaFim: data.diaInteiro ? null : (data.horaFim ?? null),
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

    const existing = (await (prisma.individualAusencias.findUnique as Function)({
      where: { id: idR.data },
      select: { id: true },
    })) as { id: string } | null
    if (!existing) return { error: "Ausência não encontrada." }

    await (prisma.individualAusencias.delete as Function)({ where: { id: idR.data } })

    revalidatePath("/individual/ausencias")
    revalidatePath("/equipe/ausencias")
    return {}
  } catch (e) {
    console.error("[deleteIndividualAusencias]", e)
    if (e instanceof Error) return { error: e.message }
    return { error: "Não foi possível remover a ausência." }
  }
}
