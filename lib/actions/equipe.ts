"use server"

import { prisma } from "@/lib/prisma"
import { MOCK_USERS } from "@/lib/qagrotis-constants"

export interface UserPerformanceData {
  userId: string
  name: string
  email: string
  classificacao: string | null
  photoPath: string | null
  sistemas: string[]
  modulos: string[]
  cenariosCriados: number
  testesExecutados: number
  errosEncontrados: number
  sucessos: number
  testesAutomatizados: number
  percentualAutomatizado: number
  score: number
}

export async function getPerformanceData(filters: {
  sistema?: string
  modulo?: string
  dataInicio?: string
  dataFim?: string
}): Promise<UserPerformanceData[]> {
  const dateFilter: { gte?: Date; lte?: Date } = {}
  if (filters.dataInicio) dateFilter.gte = new Date(filters.dataInicio)
  if (filters.dataFim) {
    const end = new Date(filters.dataFim)
    end.setHours(23, 59, 59, 999)
    dateFilter.lte = end
  }
  const hasDateFilter = !!dateFilter.gte || !!dateFilter.lte

  const [cenarios, profiles, createdUsers] = await Promise.all([
    prisma.cenario.findMany({
      where: {
        createdBy: { not: null },
        ...(filters.sistema ? { system: filters.sistema } : {}),
        ...(filters.modulo ? { module: filters.modulo } : {}),
        ...(hasDateFilter ? { createdAt: dateFilter } : {}),
      },
      select: {
        createdBy: true,
        system: true,
        module: true,
        execucoes: true,
        erros: true,
        tipo: true,
      },
    }),
    prisma.userProfile.findMany(),
    prisma.createdUser.findMany({ select: { id: true, name: true, email: true, classificacao: true, photoPath: true } }),
  ])

  // Build lookup: email (lowercase) → { id, name, classificacao, photoPath }
  type UserInfo = { id: string; name: string; classificacao: string | null; photoPath: string | null }
  const byEmail = new Map<string, UserInfo>()
  const profileMap = new Map(profiles.map((p) => [p.userId, p]))

  for (const u of MOCK_USERS) {
    const p = profileMap.get(u.id)
    byEmail.set((p?.email ?? u.email).toLowerCase(), {
      id: u.id,
      name: p?.name ?? u.name,
      classificacao: p?.classificacao ?? null,
      photoPath: p?.photoPath ?? null,
    })
  }
  for (const u of createdUsers) {
    const p = profileMap.get(u.id)
    byEmail.set((p?.email ?? u.email).toLowerCase(), {
      id: u.id,
      name: p?.name ?? u.name,
      classificacao: p?.classificacao ?? u.classificacao ?? null,
      photoPath: p?.photoPath ?? u.photoPath ?? null,
    })
  }

  // Group cenários by createdBy
  const grouped = new Map<string, typeof cenarios>()
  for (const c of cenarios) {
    if (!c.createdBy) continue
    const key = c.createdBy.toLowerCase()
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(c)
  }

  const result: UserPerformanceData[] = []

  for (const [createdByKey, userCenarios] of grouped.entries()) {
    const info = byEmail.get(createdByKey)
    const sistemas = [...new Set(userCenarios.map((c) => c.system).filter(Boolean))]
    const modulos = [...new Set(userCenarios.map((c) => c.module).filter(Boolean))]
    const cenariosCriados = userCenarios.length
    const testesExecutados = userCenarios.reduce((s, c) => s + c.execucoes, 0)
    const errosEncontrados = userCenarios.reduce((s, c) => s + c.erros, 0)
    const sucessos = Math.max(0, testesExecutados - errosEncontrados)
    const testesAutomatizados = userCenarios.filter(
      (c) => c.tipo === "Automatizado" || c.tipo === "Man./Auto."
    ).length
    const percentualAutomatizado =
      cenariosCriados > 0 ? Math.round((testesAutomatizados / cenariosCriados) * 100) : 0
    const score = testesExecutados * 10 + testesAutomatizados * 20 + cenariosCriados * 5

    result.push({
      userId: info?.id ?? createdByKey,
      name: info?.name ?? createdByKey,
      email: createdByKey,
      classificacao: info?.classificacao ?? null,
      photoPath: info?.photoPath ?? null,
      sistemas,
      modulos,
      cenariosCriados,
      testesExecutados,
      errosEncontrados,
      sucessos,
      testesAutomatizados,
      percentualAutomatizado,
      score,
    })
  }

  return result.sort((a, b) => b.score - a.score)
}

export async function getSistemasEModulos(): Promise<{
  sistemas: string[]
  modulosPorSistema: Record<string, string[]>
}> {
  const [sistemas, modulos] = await Promise.all([
    prisma.sistema.findMany({ where: { active: true }, select: { name: true }, orderBy: { name: "asc" } }),
    prisma.modulo.findMany({
      where: { active: true },
      select: { name: true, sistemaName: true },
      orderBy: { name: "asc" },
    }),
  ])

  const modulosPorSistema: Record<string, string[]> = {}
  for (const m of modulos) {
    if (!modulosPorSistema[m.sistemaName]) modulosPorSistema[m.sistemaName] = []
    if (!modulosPorSistema[m.sistemaName]!.includes(m.name)) {
      modulosPorSistema[m.sistemaName]!.push(m.name)
    }
  }

  return {
    sistemas: [...new Set(sistemas.map((s) => s.name))],
    modulosPorSistema,
  }
}
