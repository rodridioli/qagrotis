"use server"

import { prisma } from "@/core/prisma"
import {
  labelsDiasHibrido,
  normalizeDiasTrabalhoHibrido,
  sanitizeFormatoTrabalho,
} from "@/features/usuarios/lib/usuario-trabalho"
import {
  ensureUserDataNascimentoColumns,
  ensureUserHybridWorkDaysColumns,
  ensureUserWorkScheduleColumns,
} from "@/core/prisma-schema-ensure"
import { USER_PROFILE_READ_SELECT } from "@/features/usuarios/lib/prisma-user-selects"
import { unstable_cache } from "next/cache"
import { requireSession } from "@/core/session"
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
  await requireSession()
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

export interface EquipeMembroLancamentos {
  userId: string
  name: string
  accessProfile: string | null
  photoPath: string | null
  /** true quando o userId está registrado em InactiveUser. Default false (ativo). */
  isInactive: boolean
}

const _getCachedAllMembrosLancamentos = unstable_cache(
  async (): Promise<EquipeMembroLancamentos[]> => {
    const [inactiveRecords, profiles, createdUsers] = await Promise.all([
      prisma.inactiveUser.findMany({ select: { userId: true } }),
      prisma.userProfile.findMany({
        select: { userId: true, name: true, email: true, accessProfile: true, photoPath: true },
      }),
      prisma.createdUser.findMany({
        select: { id: true, name: true, email: true, accessProfile: true, photoPath: true },
      }),
    ])

    const inactiveIds = new Set(inactiveRecords.map((r) => r.userId))
    const profileMap = new Map(profiles.map((p) => [p.userId, p]))
    const byEmail = new Map<string, EquipeMembroLancamentos>()

    for (const u of createdUsers) {
      if (inactiveIds.has(u.id)) continue
      const p = profileMap.get(u.id)
      const email = (p?.email ?? u.email).trim()
      if (!email) continue
      const profile = p?.accessProfile ?? u.accessProfile ?? null
      const photoPath = p?.photoPath ?? u.photoPath ?? null
      byEmail.set(email, { userId: u.id, name: p?.name ?? u.name ?? email, accessProfile: profile, photoPath, isInactive: false })
    }

    return [...byEmail.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
  },
  ["equipe-membros-lancamentos"],
  { revalidate: 300 },
)

/**
 * Inclui ativos E inativos — ativos primeiro (α), inativos por último (α).
 * Usado pelos dashboards UX e TW para exibir todos os membros com flag isInactive.
 */
const _getCachedAllMembrosComInativos = unstable_cache(
  async (): Promise<EquipeMembroLancamentos[]> => {
    const [inactiveRecords, profiles, createdUsers] = await Promise.all([
      prisma.inactiveUser.findMany({ select: { userId: true } }),
      prisma.userProfile.findMany({
        select: { userId: true, name: true, email: true, accessProfile: true, photoPath: true },
      }),
      prisma.createdUser.findMany({
        select: { id: true, name: true, email: true, accessProfile: true, photoPath: true },
      }),
    ])

    const inactiveIds = new Set(inactiveRecords.map((r) => r.userId))
    const profileMap = new Map(profiles.map((p) => [p.userId, p]))
    const byEmail = new Map<string, EquipeMembroLancamentos>()

    for (const u of createdUsers) {
      const p = profileMap.get(u.id)
      const email = (p?.email ?? u.email).trim()
      if (!email) continue
      const profile = p?.accessProfile ?? u.accessProfile ?? null
      const photoPath = p?.photoPath ?? u.photoPath ?? null
      byEmail.set(email, {
        userId: u.id,
        name: p?.name ?? u.name ?? email,
        accessProfile: profile,
        photoPath,
        isInactive: inactiveIds.has(u.id),
      })
    }

    const all = [...byEmail.values()]
    const ativos    = all.filter((m) => !m.isInactive).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
    const inativos  = all.filter((m) =>  m.isInactive).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
    return [...ativos, ...inativos]
  },
  ["equipe-membros-lancamentos-com-inativos"],
  { revalidate: 300 },
)

/**
 * Lista membros ativos para o seletor de usuário na tab Lançamentos do Equipe.
 * Quando accessProfile é passado, filtra apenas usuários daquele perfil.
 * A query ao banco é cacheada por 5 minutos no servidor.
 */
export async function getEquipeMembrosParaLancamentos(
  accessProfile?: string | null,
): Promise<EquipeMembroLancamentos[]> {
  try {
    await requireSession()
    const all = await _getCachedAllMembrosLancamentos()
    if (!accessProfile) return all
    return all.filter((u) => u.accessProfile === accessProfile)
  } catch (e) {
    console.error("[getEquipeMembrosParaLancamentos]", e)
    return []
  }
}

/**
 * Lista membros ativos E inativos para os dashboards UX e TW.
 * Inativos são marcados com isInactive: true e aparecem por último no array.
 * Quando accessProfile é passado, filtra por perfil (mantendo ativos + inativos daquele perfil).
 */
export async function getEquipeMembrosParaLancamentosComInativos(
  accessProfile?: string | null,
): Promise<EquipeMembroLancamentos[]> {
  try {
    await requireSession()
    const all = await _getCachedAllMembrosComInativos()
    if (!accessProfile) return all
    return all.filter((u) => u.accessProfile === accessProfile)
  } catch (e) {
    console.error("[getEquipeMembrosParaLancamentosComInativos]", e)
    return []
  }
}

export async function getSistemasEModulos(): Promise<{
  sistemas: string[]
  modulosPorSistema: Record<string, string[]>
}> {
  await requireSession()
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
