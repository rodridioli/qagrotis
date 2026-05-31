"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/core/prisma"
import { requireSession } from "@/core/session"
import { buildRole, can } from "@/core/rbac/policy"
import {
  createOkrSchema,
  updateOkrSituacaoSchema,
  createObjetivoSchema,
  updateObjetivoSchema,
  cancelObjetivoSchema,
  createKeyResultSchema,
  updateKeyResultSchema,
  updateKrValorAtualSchema,
  cancelKeyResultSchema,
  createIniciativaSchema,
  updateIniciativaSchema,
  calcularProgressoObjetivo,
  calcularRiscoKr,
  type OkrDetailDto,
  type OkrListRow,
  type OkrObjetivoDto,
  type OkrKeyResultDto,
  type OkrIniciativaDto,
  type OkrPeriodoDto,
  type OkrSituacaoDto,
  type OkrObjetivoSituacaoDto,
  type OkrKrSituacaoDto,
  type OkrUnidadeDto,
  type OkrIniciativaStatusDto,
  type OkrEquipeDto,
  type CreateOkrInput,
  type UpdateOkrSituacaoInput,
  type CreateObjetivoInput,
  type UpdateObjetivoInput,
  type CancelObjetivoInput,
  type CreateKeyResultInput,
  type UpdateKeyResultInput,
  type UpdateKrValorAtualInput,
  type CancelKeyResultInput,
  type CreateIniciativaInput,
  type UpdateIniciativaInput,
} from "@/features/okrs/lib/okrs-schemas"

type ActionResult<T> = { data: T } | { error: string }

// ── Auth helpers ──────────────────────────────────────────────────────────────

async function requireOkrAccess() {
  const session = await requireSession()
  const role = buildRole(session.user.type, session.user.accessProfile)
  if (!can(role, "okr.view")) throw new Error("Não autorizado.")
  return { session, role }
}

async function requireMgr() {
  const { session, role } = await requireOkrAccess()
  if (!can(role, "okr.create")) throw new Error("Apenas Administrador:MGR pode executar esta ação.")
  return { session, role }
}

/** Verifica se o OKR está acessível para o usuário atual (MGR vê tudo; outros só equipe). */
async function assertOkrInScope(okrId: string, userId: string, isMgr: boolean): Promise<void> {
  if (isMgr) {
    const okr = await prisma.okr.findUnique({ where: { id: okrId }, select: { id: true } })
    if (!okr) throw new Error("OKR não encontrado.")
    return
  }
  // Não-MGR: só OKRs que têm ao menos um objetivo vinculado à equipe do usuário
  const user = await prisma.createdUser.findUnique({
    where: { id: userId },
    select: { accessProfile: true },
  })
  const profile = user?.accessProfile
  // Mapeia accessProfile para OkrEquipe (MGR mapeia para GESTAO)
  const equipeMap: Record<string, OkrEquipeDto> = { QA: "QA", UX: "UX", TW: "TW", MGR: "GESTAO" }
  const equipe = profile ? (equipeMap[profile] ?? null) : null
  if (!equipe) throw new Error("Não autorizado.")

  const okr = await prisma.okr.findFirst({
    where: {
      id: okrId,
      objetivos: {
        some: {
          equipes: { some: { equipe } },
        },
      },
    },
    select: { id: true },
  })
  if (!okr) throw new Error("OKR não encontrado ou sem acesso.")
}

/** Retorna se o OKR está encerrado e bloqueia edição para não-MGR. */
async function assertOkrEditavel(okrId: string, isMgr: boolean): Promise<void> {
  const okr = await prisma.okr.findUnique({ where: { id: okrId }, select: { situacao: true } })
  if (!okr) throw new Error("OKR não encontrado.")
  if (okr.situacao === "ENCERRADO" && !isMgr) {
    throw new Error("OKR encerrado. Apenas MGR pode editar.")
  }
}

// ── Código automático ─────────────────────────────────────────────────────────

async function gerarCodigoOkr(): Promise<string> {
  const result = await prisma.okr.aggregate({
    _max: { codigo: true },
  })
  const last = result._max.codigo
  let seq = 1
  if (last) {
    // Suporta formatos OKR-001 (novo) e OKR-2025-001 (legado)
    const n = parseInt(/(\d{3})$/.exec(last)?.[1] ?? "0", 10)
    if (!Number.isNaN(n)) seq = n + 1
  }
  return `OKR-${String(seq).padStart(3, "0")}`
}

// ── Mappers ───────────────────────────────────────────────────────────────────

function mapIniciativa(i: {
  id: string
  descricao: string
  status: string
  createdAt: Date
  updatedAt: Date
  responsaveis: { userId: string; iniciativa?: unknown }[]
  responsaveisUsers?: { userId: string; name: string; photoPath: string | null }[]
}): OkrIniciativaDto {
  return {
    id: i.id,
    descricao: i.descricao,
    status: i.status as OkrIniciativaStatusDto,
    responsaveis: (i.responsaveisUsers ?? []).map((r) => ({
      userId: r.userId,
      name: r.name,
      photoPath: r.photoPath,
    })),
    createdAt: i.createdAt.toISOString(),
    updatedAt: i.updatedAt.toISOString(),
  }
}

function mapKeyResult(
  kr: {
    id: string
    descricao: string
    unidade: string
    unidadePersonalizada: string | null
    valorInicial: number
    valorAtual: number
    meta: number
    situacao: string
    motivoCancelamento: string | null
    createdAt: Date
    updatedAt: Date
    responsaveis: { userId: string; name: string; photoPath: string | null }[]
    evolucao: { mes: number; ano: number; valor: number }[]
    iniciativas: {
      id: string
      descricao: string
      status: string
      createdAt: Date
      updatedAt: Date
      responsaveisUsers: { userId: string; name: string; photoPath: string | null }[]
    }[]
  },
  periodo: OkrPeriodoDto,
): OkrKeyResultDto {
  const progressoPercent =
    kr.meta > 0 ? Math.min((kr.valorAtual / kr.meta) * 100, 100) : 0
  return {
    id: kr.id,
    descricao: kr.descricao,
    unidade: kr.unidade as OkrUnidadeDto,
    unidadePersonalizada: kr.unidadePersonalizada,
    valorInicial: kr.valorInicial,
    valorAtual: kr.valorAtual,
    meta: kr.meta,
    situacao: kr.situacao as OkrKrSituacaoDto,
    motivoCancelamento: kr.motivoCancelamento,
    responsaveis: kr.responsaveis.map((r) => ({
      userId: r.userId,
      name: r.name,
      photoPath: r.photoPath,
    })),
    evolucao: kr.evolucao.map((e) => ({ mes: e.mes, ano: e.ano, valor: e.valor })),
    iniciativas: kr.iniciativas.map((i) => ({
      id: i.id,
      descricao: i.descricao,
      status: i.status as OkrIniciativaStatusDto,
      responsaveis: i.responsaveisUsers.map((r) => ({
        userId: r.userId,
        name: r.name,
        photoPath: r.photoPath,
      })),
      createdAt: i.createdAt.toISOString(),
      updatedAt: i.updatedAt.toISOString(),
    })),
    progressoPercent,
    risco:
      kr.situacao === "ATIVO"
        ? calcularRiscoKr(kr.valorAtual, kr.meta, periodo)
        : "BAIXO",
    createdAt: kr.createdAt.toISOString(),
    updatedAt: kr.updatedAt.toISOString(),
  }
}

const KR_SELECT = {
  id: true,
  descricao: true,
  unidade: true,
  unidadePersonalizada: true,
  valorInicial: true,
  valorAtual: true,
  meta: true,
  situacao: true,
  motivoCancelamento: true,
  createdAt: true,
  updatedAt: true,
  responsaveis: {
    select: {
      userId: true,
      keyResult: false,
    },
  },
  evolucao: {
    select: { mes: true, ano: true, valor: true },
    orderBy: [{ ano: "asc" as const }, { mes: "asc" as const }],
  },
  iniciativas: {
    orderBy: { createdAt: "asc" as const },
    select: {
      id: true,
      descricao: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      responsaveis: {
        select: { userId: true },
      },
    },
  },
}

// ── Listagem ──────────────────────────────────────────────────────────────────

export async function listOkrs(): Promise<ActionResult<OkrListRow[]>> {
  try {
    const { session, role } = await requireOkrAccess()
    const isMgr = can(role, "okr.create")
    const userId = session.user.id

    const equipeMap: Record<string, OkrEquipeDto> = { QA: "QA", UX: "UX", TW: "TW", MGR: "GESTAO" }
    const where = isMgr
      ? {}
      : (() => {
          const profile = session.user.accessProfile
          const equipe = profile ? (equipeMap[profile] ?? null) : null
          if (!equipe) return { id: "never" as string }
          return {
            objetivos: {
              some: {
                equipes: { some: { equipe } },
              },
            },
          }
        })()

    const okrs = await prisma.okr.findMany({
      where,
      orderBy: [{ ano: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        codigo: true,
        ano: true,
        periodo: true,
        situacao: true,
        updatedAt: true,
        objetivos: {
          select: {
            id: true,
            situacao: true,
            percentualConcluido: true,
            keyResults: {
              select: { id: true, situacao: true, valorAtual: true, meta: true },
            },
          },
        },
      },
    })

    const rows: OkrListRow[] = okrs.map((okr) => {
      const totalObjetivos = okr.objetivos.length
      const objetivosConcluidos = okr.objetivos.filter(
        (o) => o.situacao === "ATIVO" && o.percentualConcluido >= 100,
      ).length
      const allKrs = okr.objetivos.flatMap((o) => o.keyResults)
      const totalKrs = allKrs.length
      const krsConcluidos = allKrs.filter(
        (kr) => kr.situacao === "ATIVO" && kr.meta > 0 && kr.valorAtual >= kr.meta,
      ).length

      return {
        id: okr.id,
        codigo: okr.codigo,
        ano: okr.ano,
        periodo: okr.periodo as OkrPeriodoDto,
        situacao: okr.situacao as OkrSituacaoDto,
        totalObjetivos,
        objetivosConcluidos,
        totalKrs,
        krsConcluidos,
        updatedAt: okr.updatedAt.toISOString(),
      }
    })

    return { data: rows }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao listar OKRs." }
  }
}

// ── Detalhe ───────────────────────────────────────────────────────────────────

async function fetchOkrDetail(okrId: string) {
  return prisma.okr.findUnique({
    where: { id: okrId },
    select: {
      id: true,
      codigo: true,
      ano: true,
      periodo: true,
      situacao: true,
      createdAt: true,
      updatedAt: true,
      objetivos: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          descricao: true,
          situacao: true,
          motivoCancelamento: true,
          percentualConcluido: true,
          createdAt: true,
          updatedAt: true,
          equipes: { select: { equipe: true } },
          keyResults: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              descricao: true,
              unidade: true,
              unidadePersonalizada: true,
              valorInicial: true,
              valorAtual: true,
              meta: true,
              situacao: true,
              motivoCancelamento: true,
              createdAt: true,
              updatedAt: true,
              responsaveis: { select: { userId: true } },
              evolucao: {
                select: { mes: true, ano: true, valor: true },
                orderBy: [{ ano: "asc" }, { mes: "asc" }],
              },
              iniciativas: {
                orderBy: { createdAt: "asc" },
                select: {
                  id: true,
                  descricao: true,
                  status: true,
                  createdAt: true,
                  updatedAt: true,
                  responsaveis: { select: { userId: true } },
                },
              },
            },
          },
        },
      },
    },
  })
}

export async function getOkr(okrId: string): Promise<ActionResult<OkrDetailDto>> {
  try {
    const { session, role } = await requireOkrAccess()
    const isMgr = can(role, "okr.create")
    await assertOkrInScope(okrId, session.user.id, isMgr)

    const okr = await fetchOkrDetail(okrId)
    if (!okr) return { error: "OKR não encontrado." }

    // Busca nomes dos usuários referenciados
    const allUserIds = new Set<string>()
    for (const obj of okr.objetivos) {
      for (const kr of obj.keyResults) {
        for (const r of kr.responsaveis) allUserIds.add(r.userId)
        for (const ini of kr.iniciativas) {
          for (const r of ini.responsaveis) allUserIds.add(r.userId)
        }
      }
    }
    const users = await prisma.createdUser.findMany({
      where: { id: { in: [...allUserIds] } },
      select: { id: true, name: true, photoPath: true },
    })
    const userMap = new Map(users.map((u) => [u.id, u]))

    const periodo = okr.periodo as OkrPeriodoDto

    const objetivos: OkrObjetivoDto[] = okr.objetivos.map((obj) => ({
      id: obj.id,
      descricao: obj.descricao,
      equipes: obj.equipes.map((e) => e.equipe as OkrEquipeDto),
      situacao: obj.situacao as OkrObjetivoSituacaoDto,
      motivoCancelamento: obj.motivoCancelamento,
      percentualConcluido: obj.percentualConcluido,
      createdAt: obj.createdAt.toISOString(),
      updatedAt: obj.updatedAt.toISOString(),
      keyResults: obj.keyResults.map((kr) => ({
        id: kr.id,
        descricao: kr.descricao,
        unidade: kr.unidade as OkrUnidadeDto,
        unidadePersonalizada: kr.unidadePersonalizada,
        valorInicial: kr.valorInicial,
        valorAtual: kr.valorAtual,
        meta: kr.meta,
        situacao: kr.situacao as OkrKrSituacaoDto,
        motivoCancelamento: kr.motivoCancelamento,
        responsaveis: kr.responsaveis.map((r) => ({
          userId: r.userId,
          name: userMap.get(r.userId)?.name ?? r.userId,
          photoPath: userMap.get(r.userId)?.photoPath ?? null,
        })),
        evolucao: kr.evolucao.map((e) => ({ mes: e.mes, ano: e.ano, valor: e.valor })),
        iniciativas: kr.iniciativas.map((i) => ({
          id: i.id,
          descricao: i.descricao,
          status: i.status as OkrIniciativaStatusDto,
          responsaveis: i.responsaveis.map((r) => ({
            userId: r.userId,
            name: userMap.get(r.userId)?.name ?? r.userId,
            photoPath: userMap.get(r.userId)?.photoPath ?? null,
          })),
          createdAt: i.createdAt.toISOString(),
          updatedAt: i.updatedAt.toISOString(),
        })),
        progressoPercent: kr.meta > 0 ? Math.min((kr.valorAtual / kr.meta) * 100, 100) : 0,
        risco:
          kr.situacao === "ATIVO"
            ? calcularRiscoKr(kr.valorAtual, kr.meta, periodo)
            : "BAIXO",
        createdAt: kr.createdAt.toISOString(),
        updatedAt: kr.updatedAt.toISOString(),
      })),
    }))

    return {
      data: {
        id: okr.id,
        codigo: okr.codigo,
        ano: okr.ano,
        periodo,
        situacao: okr.situacao as OkrSituacaoDto,
        objetivos,
        createdAt: okr.createdAt.toISOString(),
        updatedAt: okr.updatedAt.toISOString(),
      },
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao carregar OKR." }
  }
}

// ── OKR CRUD ──────────────────────────────────────────────────────────────────

export async function createOkr(input: CreateOkrInput): Promise<ActionResult<{ id: string; codigo: string }>> {
  try {
    const { session } = await requireMgr()
    const parsed = createOkrSchema.safeParse(input)
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." }

    const codigo = await gerarCodigoOkr()
    const okr = await prisma.okr.create({
      data: {
        id: crypto.randomUUID(),
        codigo,
        ano: parsed.data.ano,
        periodo: parsed.data.periodo,
        situacao: "ATIVO",
      },
      select: { id: true, codigo: true },
    })

    revalidatePath("/equipe")
    return { data: okr }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao criar OKR." }
  }
}

export async function updateOkrSituacao(
  okrId: string,
  input: UpdateOkrSituacaoInput,
): Promise<ActionResult<void>> {
  try {
    await requireMgr()
    const parsed = updateOkrSituacaoSchema.safeParse(input)
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." }

    await prisma.okr.update({
      where: { id: okrId },
      data: { situacao: parsed.data.situacao },
    })

    revalidatePath("/equipe")
    return { data: undefined }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao atualizar OKR." }
  }
}

export async function deleteOkr(okrId: string): Promise<ActionResult<void>> {
  try {
    await requireMgr()

    const existing = await prisma.okr.findUnique({ where: { id: okrId }, select: { id: true } })
    if (!existing) return { error: "OKR não encontrado." }

    await prisma.okr.delete({ where: { id: okrId } })

    revalidatePath("/equipe")
    return { data: undefined }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao excluir OKR." }
  }
}

// ── Objetivos ─────────────────────────────────────────────────────────────────

export async function createOkrObjetivo(
  okrId: string,
  input: CreateObjetivoInput,
): Promise<ActionResult<void>> {
  try {
    await requireMgr()
    const parsed = createObjetivoSchema.safeParse(input)
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." }

    await assertOkrEditavel(okrId, true)

    await prisma.okrObjetivo.create({
      data: {
        id: crypto.randomUUID(),
        okrId,
        descricao: parsed.data.descricao,
        situacao: "ATIVO",
        percentualConcluido: 0,
        equipes: {
          create: parsed.data.equipes.map((e) => ({ equipe: e })),
        },
      },
    })

    revalidatePath("/equipe")
    return { data: undefined }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao criar objetivo." }
  }
}

export async function updateOkrObjetivo(
  objetivoId: string,
  input: UpdateObjetivoInput,
): Promise<ActionResult<void>> {
  try {
    await requireMgr()
    const parsed = updateObjetivoSchema.safeParse(input)
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." }

    const objetivo = await prisma.okrObjetivo.findUnique({
      where: { id: objetivoId },
      select: { okrId: true },
    })
    if (!objetivo) return { error: "Objetivo não encontrado." }
    await assertOkrEditavel(objetivo.okrId, true)

    await prisma.$transaction(async (tx) => {
      if (parsed.data.descricao !== undefined) {
        await tx.okrObjetivo.update({
          where: { id: objetivoId },
          data: { descricao: parsed.data.descricao },
        })
      }
      if (parsed.data.equipes !== undefined) {
        await tx.okrObjetivoEquipe.deleteMany({ where: { objetivoId } })
        await tx.okrObjetivoEquipe.createMany({
          data: parsed.data.equipes.map((e) => ({ objetivoId, equipe: e })),
        })
      }
    })

    revalidatePath("/equipe")
    return { data: undefined }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao editar objetivo." }
  }
}

export async function cancelOkrObjetivo(
  objetivoId: string,
  input: CancelObjetivoInput,
): Promise<ActionResult<void>> {
  try {
    await requireMgr()
    const parsed = cancelObjetivoSchema.safeParse(input)
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." }

    const objetivo = await prisma.okrObjetivo.findUnique({
      where: { id: objetivoId },
      select: { okrId: true },
    })
    if (!objetivo) return { error: "Objetivo não encontrado." }
    await assertOkrEditavel(objetivo.okrId, true)

    await prisma.okrObjetivo.update({
      where: { id: objetivoId },
      data: { situacao: "CANCELADO", motivoCancelamento: parsed.data.motivoCancelamento },
    })

    revalidatePath("/equipe")
    return { data: undefined }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao cancelar objetivo." }
  }
}

// ── Key Results ───────────────────────────────────────────────────────────────

async function recalcularProgressoObjetivo(objetivoId: string, tx: typeof prisma | Parameters<Parameters<typeof prisma.$transaction>[0]>[0] = prisma): Promise<void> {
  const krs = await (tx as typeof prisma).okrKeyResult.findMany({
    where: { objetivoId },
    select: { valorAtual: true, meta: true, situacao: true },
  })
  const progresso = calcularProgressoObjetivo(krs)
  await (tx as typeof prisma).okrObjetivo.update({
    where: { id: objetivoId },
    data: { percentualConcluido: progresso },
  })
}

export async function createOkrKeyResult(
  objetivoId: string,
  input: CreateKeyResultInput,
): Promise<ActionResult<void>> {
  try {
    const { session, role } = await requireOkrAccess()
    if (!can(role, "okr.kr.create")) return { error: "Sem permissão para criar Key Results." }
    const parsed = createKeyResultSchema.safeParse(input)
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." }

    const objetivo = await prisma.okrObjetivo.findUnique({
      where: { id: objetivoId },
      select: { okrId: true },
    })
    if (!objetivo) return { error: "Objetivo não encontrado." }

    const isMgr = can(role, "okr.create")
    await assertOkrEditavel(objetivo.okrId, isMgr)

    const krId = crypto.randomUUID()
    await prisma.$transaction(async (tx) => {
      await tx.okrKeyResult.create({
        data: {
          id: krId,
          objetivoId,
          descricao: parsed.data.descricao,
          unidade: parsed.data.unidade,
          unidadePersonalizada: parsed.data.unidadePersonalizada ?? null,
          valorInicial: parsed.data.valorInicial,
          valorAtual: parsed.data.valorInicial,
          meta: parsed.data.meta,
          situacao: "ATIVO",
          responsaveis: {
            create: parsed.data.responsaveis.map((userId) => ({ userId })),
          },
        },
      })
      await recalcularProgressoObjetivo(objetivoId, tx)
    })

    revalidatePath("/equipe")
    return { data: undefined }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao criar Key Result." }
  }
}

export async function updateOkrKeyResult(
  krId: string,
  input: UpdateKeyResultInput,
): Promise<ActionResult<void>> {
  try {
    const { session, role } = await requireOkrAccess()
    if (!can(role, "okr.kr.edit")) return { error: "Sem permissão para editar Key Results." }
    const parsed = updateKeyResultSchema.safeParse(input)
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." }

    const kr = await prisma.okrKeyResult.findUnique({
      where: { id: krId },
      select: { objetivoId: true, objetivo: { select: { okrId: true } } },
    })
    if (!kr) return { error: "Key Result não encontrado." }

    const isMgr = can(role, "okr.create")
    await assertOkrEditavel(kr.objetivo.okrId, isMgr)

    await prisma.$transaction(async (tx) => {
      await tx.okrKeyResult.update({
        where: { id: krId },
        data: {
          descricao: parsed.data.descricao,
          unidade: parsed.data.unidade,
          unidadePersonalizada: parsed.data.unidadePersonalizada,
          valorInicial: parsed.data.valorInicial,
          meta: parsed.data.meta,
        },
      })
      if (parsed.data.responsaveis !== undefined) {
        await tx.okrKrResponsavel.deleteMany({ where: { keyResultId: krId } })
        await tx.okrKrResponsavel.createMany({
          data: parsed.data.responsaveis.map((userId) => ({ keyResultId: krId, userId })),
        })
      }
      await recalcularProgressoObjetivo(kr.objetivoId, tx)
    })

    revalidatePath("/equipe")
    return { data: undefined }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao editar Key Result." }
  }
}

export async function updateOkrKeyResultValorAtual(
  krId: string,
  input: UpdateKrValorAtualInput,
): Promise<ActionResult<void>> {
  try {
    const { session, role } = await requireOkrAccess()
    if (!can(role, "okr.kr.updateValue")) return { error: "Sem permissão." }
    const parsed = updateKrValorAtualSchema.safeParse(input)
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." }

    const kr = await prisma.okrKeyResult.findUnique({
      where: { id: krId },
      select: {
        objetivoId: true,
        situacao: true,
        responsaveis: { select: { userId: true } },
        objetivo: { select: { okrId: true } },
      },
    })
    if (!kr) return { error: "Key Result não encontrado." }
    if (kr.situacao === "CANCELADO") return { error: "Key Result cancelado." }

    const isMgr = can(role, "okr.create")
    // Não-admin só pode atualizar se for responsável
    if (!isMgr && !can(role, "okr.kr.edit")) {
      const isResponsavel = kr.responsaveis.some((r) => r.userId === session.user.id)
      if (!isResponsavel) return { error: "Você não é responsável por este Key Result." }
    }

    await assertOkrEditavel(kr.objetivo.okrId, isMgr)

    const now = new Date()
    const mes = now.getMonth() + 1
    const ano = now.getFullYear()

    await prisma.$transaction(async (tx) => {
      await tx.okrKeyResult.update({
        where: { id: krId },
        data: { valorAtual: parsed.data.valorAtual },
      })
      await tx.okrKrEvolucao.upsert({
        where: { keyResultId_mes_ano: { keyResultId: krId, mes, ano } },
        update: { valor: parsed.data.valorAtual },
        create: {
          id: crypto.randomUUID(),
          keyResultId: krId,
          mes,
          ano,
          valor: parsed.data.valorAtual,
        },
      })
      await recalcularProgressoObjetivo(kr.objetivoId, tx)
    })

    revalidatePath("/equipe")
    return { data: undefined }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao atualizar valor." }
  }
}

export async function cancelOkrKeyResult(
  krId: string,
  input: CancelKeyResultInput,
): Promise<ActionResult<void>> {
  try {
    const { session, role } = await requireOkrAccess()
    if (!can(role, "okr.kr.cancel")) return { error: "Sem permissão para cancelar Key Results." }
    const parsed = cancelKeyResultSchema.safeParse(input)
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." }

    const kr = await prisma.okrKeyResult.findUnique({
      where: { id: krId },
      select: { objetivoId: true, objetivo: { select: { okrId: true } } },
    })
    if (!kr) return { error: "Key Result não encontrado." }

    const isMgr = can(role, "okr.create")
    await assertOkrEditavel(kr.objetivo.okrId, isMgr)

    await prisma.$transaction(async (tx) => {
      await tx.okrKeyResult.update({
        where: { id: krId },
        data: { situacao: "CANCELADO", motivoCancelamento: parsed.data.motivoCancelamento },
      })
      await recalcularProgressoObjetivo(kr.objetivoId, tx)
    })

    revalidatePath("/equipe")
    return { data: undefined }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao cancelar Key Result." }
  }
}

// ── Iniciativas ───────────────────────────────────────────────────────────────

export async function createOkrIniciativa(
  krId: string,
  input: CreateIniciativaInput,
): Promise<ActionResult<void>> {
  try {
    const { session, role } = await requireOkrAccess()
    if (!can(role, "okr.iniciativa.manage")) return { error: "Sem permissão para criar Iniciativas." }
    const parsed = createIniciativaSchema.safeParse(input)
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." }

    const kr = await prisma.okrKeyResult.findUnique({
      where: { id: krId },
      select: { objetivo: { select: { okrId: true } } },
    })
    if (!kr) return { error: "Key Result não encontrado." }

    const isMgr = can(role, "okr.create")
    await assertOkrEditavel(kr.objetivo.okrId, isMgr)

    await prisma.okrIniciativa.create({
      data: {
        id: crypto.randomUUID(),
        keyResultId: krId,
        descricao: parsed.data.descricao,
        status: "PENDENTE",
        responsaveis: {
          create: parsed.data.responsaveis.map((userId) => ({ userId })),
        },
      },
    })

    revalidatePath("/equipe")
    return { data: undefined }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao criar iniciativa." }
  }
}

export async function updateOkrIniciativa(
  iniciativaId: string,
  input: UpdateIniciativaInput,
): Promise<ActionResult<void>> {
  try {
    const { session, role } = await requireOkrAccess()
    const canManage = can(role, "okr.iniciativa.manage")
    const canUpdateStatus = can(role, "okr.iniciativa.updateStatus")
    if (!canManage && !canUpdateStatus) return { error: "Sem permissão." }

    const parsed = updateIniciativaSchema.safeParse(input)
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." }

    const iniciativa = await prisma.okrIniciativa.findUnique({
      where: { id: iniciativaId },
      select: {
        keyResultId: true,
        responsaveis: { select: { userId: true } },
        keyResult: { select: { objetivo: { select: { okrId: true } } } },
      },
    })
    if (!iniciativa) return { error: "Iniciativa não encontrada." }

    const isMgr = can(role, "okr.create")

    // Usuário padrão (apenas updateStatus): só pode se for responsável, e somente atualizar status
    if (!canManage && canUpdateStatus) {
      const isResponsavel = iniciativa.responsaveis.some((r) => r.userId === session.user.id)
      if (!isResponsavel) return { error: "Você não é responsável por esta iniciativa." }
      if (parsed.data.descricao !== undefined || parsed.data.responsaveis !== undefined) {
        return { error: "Sem permissão para editar descrição ou responsáveis." }
      }
    }

    await assertOkrEditavel(iniciativa.keyResult.objetivo.okrId, isMgr)

    await prisma.$transaction(async (tx) => {
      await tx.okrIniciativa.update({
        where: { id: iniciativaId },
        data: {
          descricao: parsed.data.descricao,
          status: parsed.data.status,
        },
      })
      if (canManage && parsed.data.responsaveis !== undefined) {
        await tx.okrIniciativaResponsavel.deleteMany({ where: { iniciativaId } })
        await tx.okrIniciativaResponsavel.createMany({
          data: parsed.data.responsaveis.map((userId) => ({ iniciativaId, userId })),
        })
      }
    })

    revalidatePath("/equipe")
    return { data: undefined }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao atualizar iniciativa." }
  }
}

export async function deleteOkrIniciativa(iniciativaId: string): Promise<ActionResult<void>> {
  try {
    const { session, role } = await requireOkrAccess()
    if (!can(role, "okr.iniciativa.manage")) return { error: "Sem permissão para excluir iniciativas." }

    const iniciativa = await prisma.okrIniciativa.findUnique({
      where: { id: iniciativaId },
      select: { keyResult: { select: { objetivo: { select: { okrId: true } } } } },
    })
    if (!iniciativa) return { error: "Iniciativa não encontrada." }

    const isMgr = can(role, "okr.create")
    await assertOkrEditavel(iniciativa.keyResult.objetivo.okrId, isMgr)

    await prisma.okrIniciativa.delete({ where: { id: iniciativaId } })

    revalidatePath("/equipe")
    return { data: undefined }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao excluir iniciativa." }
  }
}

// ── Usuários da equipe (para select de responsáveis) ─────────────────────────

export interface OkrEquipeMembro {
  id: string
  name: string
  photoPath: string | null
  accessProfile: string | null
}

export async function getMembrosByEquipes(
  equipes: OkrEquipeDto[],
): Promise<ActionResult<OkrEquipeMembro[]>> {
  try {
    await requireOkrAccess()

    // Mapeia equipes OKR para perfis de acesso
    const profileMap: Record<OkrEquipeDto, string | null> = {
      QA: "QA",
      UX: "UX",
      TW: "TW",
      GESTAO: "MGR",
    }
    const profiles = equipes.map((e) => profileMap[e]).filter(Boolean) as string[]

    // Exclui usuários inactivos (sem relação declarada no schema, filtro manual)
    const inactiveRows = await prisma.inactiveUser.findMany({ select: { userId: true } })
    const inactiveIds = inactiveRows.map((r) => r.userId)

    const users = await prisma.createdUser.findMany({
      where: {
        accessProfile: { in: profiles as ("QA" | "UX" | "TW" | "MGR")[] },
        ...(inactiveIds.length > 0 ? { NOT: { id: { in: inactiveIds } } } : {}),
      },
      select: { id: true, name: true, photoPath: true, accessProfile: true },
      orderBy: { name: "asc" },
    })

    return {
      data: users.map((u) => ({
        id: u.id,
        name: u.name,
        photoPath: u.photoPath,
        accessProfile: u.accessProfile,
      })),
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao buscar membros." }
  }
}
