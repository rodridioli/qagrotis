"use server"

import { auth } from "@/core/auth"
import { buildRole, can } from "@/core/rbac/policy"
import { prisma } from "@/core/prisma"
import { getActiveQaUsers } from "@/features/usuarios/actions/usuarios"

async function requireMgr() {
  const session = await auth()
  if (!session?.user) throw new Error("Não autenticado.")
  const role = buildRole(session.user.type, session.user.accessProfile)
  if (!can(role, "individual.viewOthers") || session.user.type !== "Administrador") {
    throw new Error("Não autorizado.")
  }
}

export async function getMgrDashboardStats(): Promise<{
  perfisDeAcesso: number
  usuarios: number
  feedbacks: number
  avaliacoes: number
} | { error: string }> {
  try {
    await requireMgr()
    const [users, feedbacks, avaliacoes] = await Promise.all([
      getActiveQaUsers(),
      (prisma.individualFeedback as { count: () => Promise<number> }).count(),
      (prisma.individualPerformanceEvaluation as { count: () => Promise<number> }).count(),
    ])
    const perfisDeAcesso = new Set(
      users.map((u) => u.accessProfile).filter(Boolean),
    ).size
    return { perfisDeAcesso, usuarios: users.length, feedbacks, avaliacoes }
  } catch (e) {
    console.error("[getMgrDashboardStats]", e)
    return { error: e instanceof Error ? e.message : "Erro ao carregar estatísticas." }
  }
}

export async function getMgrRecentAvaliacoes(filters?: {
  perfil?: string
  dataInicio?: string
  dataFim?: string
}): Promise<
  | Array<{
      id: string
      evaluatedUserName: string
      evaluatedUserProfile: string
      evaluatorName: string
      score: number | null
      createdAt: string
    }>
  | { error: string }
> {
  try {
    await requireMgr()

    const where: Record<string, unknown> = {}
    if (filters?.dataInicio || filters?.dataFim) {
      where.createdAt = {
        ...(filters.dataInicio ? { gte: new Date(filters.dataInicio) } : {}),
        ...(filters.dataFim ? { lte: new Date(filters.dataFim + "T23:59:59Z") } : {}),
      }
    }

    const [users, rows] = await Promise.all([
      getActiveQaUsers(),
      (
        prisma.individualPerformanceEvaluation as {
          findMany: (args: unknown) => Promise<
            Array<{
              id: string
              evaluatedUserId: string
              evaluatorUserId: string
              pontuacaoPercent: number | null
              createdAt: Date
            }>
          >
        }
      ).findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          evaluatedUserId: true,
          evaluatorUserId: true,
          pontuacaoPercent: true,
          createdAt: true,
        },
      }),
    ])

    const userMap = new Map(users.map((u) => [u.id, u]))

    let result = rows.map((row) => {
      const evaluated = userMap.get(row.evaluatedUserId)
      const evaluator = userMap.get(row.evaluatorUserId)
      return {
        id: row.id,
        evaluatedUserName: evaluated?.name ?? row.evaluatedUserId,
        evaluatedUserProfile: evaluated?.accessProfile ?? "",
        evaluatorName: evaluator?.name ?? row.evaluatorUserId,
        score: row.pontuacaoPercent ?? null,
        createdAt: row.createdAt.toISOString(),
      }
    })

    if (filters?.perfil) {
      const p = filters.perfil.toUpperCase()
      result = result.filter((r) => r.evaluatedUserProfile.toUpperCase() === p)
    }

    return result.slice(0, 5)
  } catch (e) {
    console.error("[getMgrRecentAvaliacoes]", e)
    return { error: e instanceof Error ? e.message : "Erro ao carregar avaliações." }
  }
}

export async function getMgrUsuariosPorPerfil(): Promise<
  Array<{ perfil: string; count: number }> | { error: string }
> {
  try {
    await requireMgr()
    const users = await getActiveQaUsers()
    const counts = new Map<string, number>()
    for (const u of users) {
      const p = u.accessProfile ?? "Sem perfil"
      counts.set(p, (counts.get(p) ?? 0) + 1)
    }
    return Array.from(counts.entries())
      .map(([perfil, count]) => ({ perfil, count }))
      .sort((a, b) => b.count - a.count)
  } catch (e) {
    console.error("[getMgrUsuariosPorPerfil]", e)
    return { error: e instanceof Error ? e.message : "Erro ao carregar usuários por perfil." }
  }
}

export async function getMgrSmallCardStats(): Promise<{
  avaliacoes: number
  feedbacks: number
  chapters: number
  ausencias: number
} | { error: string }> {
  try {
    await requireMgr()
    const [avaliacoes, feedbacks, chapters] = await Promise.all([
      (
        prisma.individualPerformanceEvaluation as {
          count: (args: unknown) => Promise<number>
        }
      ).count({ where: { status: "CONCLUIDA" } }),
      (
        prisma.individualFeedback as {
          count: (args: unknown) => Promise<number>
        }
      ).count({ where: { status: "CONCLUIDA" } }),
      (prisma.equipeChapter as { count: () => Promise<number> }).count(),
    ])
    return { avaliacoes, feedbacks, chapters, ausencias: 0 }
  } catch (e) {
    console.error("[getMgrSmallCardStats]", e)
    return { error: e instanceof Error ? e.message : "Erro ao carregar estatísticas." }
  }
}
