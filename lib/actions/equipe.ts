"use server"

import { prisma } from "@/lib/prisma"
import {
  labelsDiasHibrido,
  normalizeDiasTrabalhoHibrido,
  sanitizeFormatoTrabalho,
} from "@/lib/usuario-trabalho"
import {
  ensureUserDataNascimentoColumns,
  ensureUserHybridWorkDaysColumns,
  ensureUserWorkScheduleColumns,
} from "@/lib/prisma-schema-ensure"
import { USER_PROFILE_READ_SELECT } from "@/lib/prisma-user-selects"
import { resolveHistoricoRunnerEmailKey } from "@/lib/historico-runner-attribution"
export interface UserPerformanceData {
  userId: string
  name: string
  email: string
  accessProfile?: "QA" | "UX" | "TW" | "MGR" | null
  classificacao: string | null
  photoPath: string | null
  /** Sistemas e módulos onde o usuário tem cenários (atividade) no período filtrado */
  atividadePorSistema: { sistema: string; modulos: string[] }[]
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
  try {
    await ensureUserDataNascimentoColumns()

    const dateFilter: { gte?: Date; lte?: Date } = {}
    if (filters.dataInicio) dateFilter.gte = new Date(filters.dataInicio)
    if (filters.dataFim) {
      // Espera ISO (instantes no tempo) vindo do cliente — alinha com filtros do dashboard no fuso local.
      dateFilter.lte = new Date(filters.dataFim)
    }
    const hasDateFilter = !!dateFilter.gte || !!dateFilter.lte

    const cenarioCreatedAtWhere: { gte?: Date; lte?: Date } = {}
    if (hasDateFilter) {
      if (dateFilter.gte) cenarioCreatedAtWhere.gte = dateFilter.gte
      if (dateFilter.lte) cenarioCreatedAtWhere.lte = dateFilter.lte
    }

    const [inactiveRecords, profiles, createdUsers, oauthUsers, cenarios, cenariosAuthorLookup, activeSuites] =
      await Promise.all([
      prisma.inactiveUser.findMany({ select: { userId: true } }),
      prisma.userProfile.findMany({ select: USER_PROFILE_READ_SELECT }),
      prisma.createdUser.findMany({
        select: { id: true, name: true, email: true, accessProfile: true, classificacao: true, photoPath: true },
      }),
      prisma.user.findMany({
        select: { id: true, name: true, email: true, image: true },
      }),
      prisma.cenario.findMany({
        where: {
          createdBy: { not: null },
          ...(filters.sistema ? { system: filters.sistema } : {}),
          ...(filters.modulo ? { module: filters.modulo } : {}),
          ...(hasDateFilter && Object.keys(cenarioCreatedAtWhere).length > 0
            ? { createdAt: cenarioCreatedAtWhere }
            : {}),
        },
        select: {
          id: true,
          createdBy: true,
          system: true,
          module: true,
          tipo: true,
          createdAt: true,
        },
      }),
      // Autor por cenário para fallback do histórico (sem filtro módulo/data — evita perder atribuição vs. dashboard).
      prisma.cenario.findMany({
        where: {
          createdBy: { not: null },
          ...(filters.sistema ? { system: filters.sistema } : {}),
        },
        select: { id: true, createdBy: true },
      }),
      prisma.suite.findMany({
        where: {
          active: true,
          ...(filters.sistema ? { sistema: filters.sistema } : {}),
        },
        select: { historico: true },
      }),
    ])

    const normalize = (v: string | null | undefined) => (v ?? "").trim().toLowerCase()
    const inactiveIds = new Set(inactiveRecords.map((r) => r.userId))
    const profileMap = new Map(profiles.map((p) => [p.userId, p]))

    type UserInfo = { id: string; name: string; email: string; accessProfile: "QA" | "UX" | "TW" | "MGR" | null; classificacao: string | null; photoPath: string | null; active: boolean }
    const usersByEmail = new Map<string, UserInfo>()
    const upsert = (base: {
      id: string
      name: string
      email: string
      accessProfile?: "QA" | "UX" | "TW" | "MGR" | null
      classificacao?: string | null
      photoPath?: string | null
      active: boolean
    }) => {
      const p = profileMap.get(base.id)
      const email = (p?.email ?? base.email).trim()
      if (!email) return
      usersByEmail.set(email.toLowerCase(), {
        id: base.id,
        name: p?.name ?? base.name,
        email,
        accessProfile: ((p?.accessProfile ?? base.accessProfile) ?? null) as "QA" | "UX" | "TW" | "MGR" | null,
        classificacao: p?.classificacao ?? base.classificacao ?? null,
        photoPath: p?.photoPath ?? base.photoPath ?? null,
        active: base.active && !inactiveIds.has(base.id),
      })
    }

    for (const u of createdUsers) {
      upsert({
        id: u.id,
        name: u.name,
        email: u.email,
        accessProfile: (u as { accessProfile?: "QA" | "UX" | "TW" | "MGR" | null }).accessProfile ?? null,
        classificacao: u.classificacao ?? null,
        photoPath: u.photoPath ?? null,
        active: true,
      })
    }
    for (const u of oauthUsers) {
      if (!u.email?.trim()) continue
      if (!usersByEmail.has(u.email.toLowerCase())) {
        upsert({
          id: u.id,
          name: u.name ?? u.email,
          email: u.email,
          accessProfile: null,
          classificacao: null,
          photoPath: u.image ?? null,
          active: true,
        })
      }
    }

    const activeUsers = [...usersByEmail.values()].filter((u) => u.active)
    const scenarioAuthorEmailByScenarioId = new Map<string, string>()
    for (const c of cenariosAuthorLookup) {
      const author = normalize(c.createdBy)
      if (!author) continue
      scenarioAuthorEmailByScenarioId.set(c.id, author)
    }

    const knownEmailKeys = new Set<string>(usersByEmail.keys())
    const nameExactToEmailKey = new Map<string, string>()
    for (const u of usersByEmail.values()) {
      const nm = (u.name ?? "").trim()
      if (nm) nameExactToEmailKey.set(nm, u.email.toLowerCase())
    }

    const counters = new Map<string, {
      cenariosCriados: number
      testesExecutados: number
      errosEncontrados: number
      sucessos: number
      testesAutomatizados: number
      bySystem: Map<string, Set<string>>
    }>()
    const ensureCounter = (emailKey: string) => {
      if (!counters.has(emailKey)) {
        counters.set(emailKey, {
          cenariosCriados: 0,
          testesExecutados: 0,
          errosEncontrados: 0,
          sucessos: 0,
          testesAutomatizados: 0,
          bySystem: new Map(),
        })
      }
      return counters.get(emailKey)!
    }

    // Cenários cadastrados por usuário (base para % automatizado e sistemas/módulos).
    for (const c of cenarios) {
      const owner = normalize(c.createdBy)
      if (!owner) continue
      const bucket = ensureCounter(owner)
      bucket.cenariosCriados += 1
      if (c.tipo === "Automatizado" || c.tipo === "Man./Auto.") {
        bucket.testesAutomatizados += 1
      }
      const system = (c.system ?? "").trim()
      const modulo = (c.module ?? "").trim()
      if (system) {
        if (!bucket.bySystem.has(system)) bucket.bySystem.set(system, new Set())
        if (modulo) bucket.bySystem.get(system)!.add(modulo)
      }
    }

    const parseHistoricoTimestamp = (h: { timestamp?: number; data?: string; hora?: string }) => {
      if (typeof h.timestamp === "number" && Number.isFinite(h.timestamp)) return h.timestamp
      if (!h.data) return 0
      const [dd, mm, yyyy] = h.data.split("/")
      if (!dd || !mm || !yyyy) return 0
      const hour = h.hora?.slice(0, 2) ?? "00"
      const minute = h.hora?.slice(3, 5) ?? "00"
      const d = new Date(`${yyyy}-${mm}-${dd}T${hour}:${minute}:00`)
      return Number.isNaN(d.getTime()) ? 0 : d.getTime()
    }

    // Testes/sucessos/erros: histórico de suítes ativas — atribuição ao executor (`executadoPor`), como no dashboard.
    for (const suite of activeSuites) {
      const historico = (suite.historico as unknown as Array<{
        id: string
        module?: string
        timestamp?: number
        data?: string
        hora?: string
        resultado: "Sucesso" | "Erro" | "Pendente" | "Alerta"
        executadoPor?: string
      }>) ?? []
      for (const h of historico) {
        if (filters.modulo && normalize(h.module) !== normalize(filters.modulo)) continue
        const ts = parseHistoricoTimestamp(h)
        if (hasDateFilter) {
          if (dateFilter.gte && ts < dateFilter.gte.getTime()) continue
          if (dateFilter.lte && ts > dateFilter.lte.getTime()) continue
        }
        const runnerKey = resolveHistoricoRunnerEmailKey(h, scenarioAuthorEmailByScenarioId, {
          knownEmailKeys,
          nameExactToEmailKey,
        })
        if (!runnerKey) continue
        const bucket = ensureCounter(runnerKey)
        bucket.testesExecutados += 1
        if (h.resultado === "Erro") bucket.errosEncontrados += 1
        if (h.resultado === "Sucesso") bucket.sucessos += 1
      }
    }

    const result: UserPerformanceData[] = activeUsers.map((u) => {
      const key = u.email.toLowerCase()
      const bucket = counters.get(key)
      const cenariosCriados = bucket?.cenariosCriados ?? 0
      const testesAutomatizados = bucket?.testesAutomatizados ?? 0
      const percentualAutomatizado =
        cenariosCriados > 0 ? Math.round((testesAutomatizados / cenariosCriados) * 100) : 0
      const atividadePorSistema = bucket
        ? [...bucket.bySystem.entries()]
            .map(([sistema, modSet]) => ({
              sistema,
              modulos: [...modSet].sort((a, b) => a.localeCompare(b, "pt-BR")),
            }))
            .sort((a, b) => a.sistema.localeCompare(b.sistema, "pt-BR"))
        : []

      return {
        userId: u.id,
        name: u.name,
        email: u.email,
        classificacao: u.classificacao,
        accessProfile: u.accessProfile,
        photoPath: u.photoPath,
        atividadePorSistema,
        cenariosCriados,
        testesExecutados: bucket?.testesExecutados ?? 0,
        errosEncontrados: bucket?.errosEncontrados ?? 0,
        sucessos: bucket?.sucessos ?? 0,
        testesAutomatizados,
        percentualAutomatizado,
        score:
          (bucket?.testesExecutados ?? 0) * 1000000 +
          percentualAutomatizado * 1000 +
          cenariosCriados,
      }
    })

    return result.sort((a, b) =>
      (b.testesExecutados - a.testesExecutados) ||
      (b.percentualAutomatizado - a.percentualAutomatizado) ||
      (b.cenariosCriados - a.cenariosCriados) ||
      a.name.localeCompare(b.name, "pt-BR")
    )
  } catch (e) {
    console.error("[getPerformanceData]", e)
    return []
  }
}

/** Usuário ativo com dados de cadastro (equipe: aniversários / horários). */
export interface EquipeUsuarioCadastro {
  userId: string
  name: string
  email: string
  classificacao: string | null
  photoPath: string | null
  /** `yyyy-mm-dd` quando definida */
  dataNascimentoIso: string | null
  horarioEntrada: string | null
  horarioSaida: string | null
  /** Presencial, Híbrido ou Remoto (cadastro de usuários). */
  formatoTrabalho: string
  /** Texto para tooltip na coluna Formato quando Híbrido (dias não presenciais). */
  hybridNaoPresencialTooltip: string | null
}

function toDateOnlyIso(d: Date | null | undefined): string | null {
  if (!d) return null
  const t = d.getTime()
  if (Number.isNaN(t)) return null
  return d.toISOString().slice(0, 10)
}

/**
 * Lista usuários ativos para abas Aniversários e Horários (um round-trip ao banco).
 */
export async function getEquipeListagemCadastro(): Promise<{
  aniversariantes: EquipeUsuarioCadastro[]
  comHorario: EquipeUsuarioCadastro[]
}> {
  try {
    await ensureUserDataNascimentoColumns()
    await ensureUserWorkScheduleColumns()
    await ensureUserHybridWorkDaysColumns()

    const [inactiveRecords, profiles, createdUsers, oauthUsers] = await Promise.all([
      prisma.inactiveUser.findMany({ select: { userId: true } }),
      prisma.userProfile.findMany({ select: USER_PROFILE_READ_SELECT }),
      prisma.createdUser.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          classificacao: true,
          photoPath: true,
          dataNascimento: true,
          horarioEntrada: true,
          horarioSaida: true,
          formatoTrabalho: true,
          diasTrabalhoHibrido: true,
        },
      }),
      prisma.user.findMany({
        select: { id: true, name: true, email: true, image: true },
      }),
    ])

    const inactiveIds = new Set(inactiveRecords.map((r) => r.userId))
    const profileMap = new Map(profiles.map((p) => [p.userId, p]))

    type Row = {
      userId: string
      name: string
      email: string
      classificacao: string | null
      photoPath: string | null
      dataNascimentoIso: string | null
      horarioEntrada: string | null
      horarioSaida: string | null
      formatoTrabalho: string | null
      diasTrabalhoHibrido: unknown
      active: boolean
    }
    const usersByEmail = new Map<string, Row>()

    const upsert = (base: {
      id: string
      name: string
      email: string
      classificacao?: string | null
      photoPath?: string | null
      dataNascimento?: Date | null
      horarioEntrada?: string | null
      horarioSaida?: string | null
      formatoTrabalho?: string | null
      diasTrabalhoHibrido?: unknown
      active: boolean
    }) => {
      const p = profileMap.get(base.id)
      const email = (p?.email ?? base.email).trim()
      if (!email) return
      const dn = p?.dataNascimento ?? base.dataNascimento ?? null
      const he = p?.horarioEntrada ?? base.horarioEntrada ?? null
      const hs = p?.horarioSaida ?? base.horarioSaida ?? null
      const fmt = p?.formatoTrabalho ?? base.formatoTrabalho ?? null
      const diasH = p?.diasTrabalhoHibrido ?? base.diasTrabalhoHibrido
      usersByEmail.set(email.toLowerCase(), {
        userId: base.id,
        name: (p?.name ?? base.name).trim() || base.name,
        email,
        classificacao: p?.classificacao ?? base.classificacao ?? null,
        photoPath: p?.photoPath ?? base.photoPath ?? null,
        dataNascimentoIso: toDateOnlyIso(dn),
        horarioEntrada: he?.trim() ? he.trim() : null,
        horarioSaida: hs?.trim() ? hs.trim() : null,
        formatoTrabalho: fmt,
        diasTrabalhoHibrido: diasH,
        active: base.active && !inactiveIds.has(base.id),
      })
    }

    for (const u of createdUsers) {
      upsert({
        id: u.id,
        name: u.name,
        email: u.email,
        classificacao: u.classificacao ?? null,
        photoPath: u.photoPath ?? null,
        dataNascimento: u.dataNascimento,
        horarioEntrada: u.horarioEntrada,
        horarioSaida: u.horarioSaida,
        formatoTrabalho: u.formatoTrabalho,
        diasTrabalhoHibrido: u.diasTrabalhoHibrido,
        active: true,
      })
    }
    for (const u of oauthUsers) {
      if (!u.email?.trim()) continue
      if (!usersByEmail.has(u.email.toLowerCase())) {
        upsert({
          id: u.id,
          name: u.name ?? u.email,
          email: u.email,
          classificacao: null,
          photoPath: u.image ?? null,
          dataNascimento: null,
          horarioEntrada: null,
          horarioSaida: null,
          formatoTrabalho: null,
          diasTrabalhoHibrido: undefined,
          active: true,
        })
      }
    }

    const all = [...usersByEmail.values()].filter((u) => u.active)
    const sortName = (a: Row, b: Row) => a.name.localeCompare(b.name, "pt-BR")

    const strip = (r: Row): EquipeUsuarioCadastro => {
      const fmt = sanitizeFormatoTrabalho(r.formatoTrabalho) ?? "Presencial"
      const diasNao = normalizeDiasTrabalhoHibrido(r.diasTrabalhoHibrido)
      const hybridNaoPresencialTooltip =
        fmt === "Híbrido"
          ? diasNao.length > 0
            ? `Não presencial: ${labelsDiasHibrido(diasNao)}.`
            : "Nenhum dia fora do escritório cadastrado no perfil."
          : null
      return {
        userId: r.userId,
        name: r.name,
        email: r.email,
        classificacao: r.classificacao,
        photoPath: r.photoPath,
        dataNascimentoIso: r.dataNascimentoIso,
        horarioEntrada: r.horarioEntrada,
        horarioSaida: r.horarioSaida,
        formatoTrabalho: fmt,
        hybridNaoPresencialTooltip,
      }
    }

    const aniversariantes = all
      .filter((u) => u.dataNascimentoIso)
      .sort(sortName)
      .map(strip)

    const comHorario = all
      .filter((u) => u.horarioEntrada && u.horarioSaida)
      .sort(sortName)
      .map(strip)

    return { aniversariantes, comHorario }
  } catch (e) {
    console.error("[getEquipeListagemCadastro]", e)
    return { aniversariantes: [], comHorario: [] }
  }
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
