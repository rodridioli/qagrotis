"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/core/prisma"
import { requireSession } from "@/core/session"
import { buildRole, can } from "@/core/rbac/policy"

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LiderRow {
  id: string
  name: string
  email: string
  accessProfile: "QA" | "UX" | "TW"
  memberCount: number
}

export interface MembroVinculado {
  id: string
  name: string
  email: string
  accessProfile: "QA" | "UX" | "TW"
  linkedAt: string
}

export interface MembroDisponivel {
  id: string
  name: string
  email: string
  accessProfile: "QA" | "UX" | "TW"
}

// ── Auth guard ────────────────────────────────────────────────────────────────

async function requireEquipesAccess() {
  const session = await requireSession()
  const role = buildRole(session.user.type, session.user.accessProfile)
  if (!can(role, "config.equipes")) throw new Error("Não autorizado.")
  return session
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const LEADER_PROFILES = new Set(["QA", "UX", "TW"])

function isLeaderProfile(p: string | null | undefined): p is "QA" | "UX" | "TW" {
  return !!p && LEADER_PROFILES.has(p)
}

// ── Public actions ────────────────────────────────────────────────────────────

/** Lista todos os Administradores QA/UX/TW com contagem de membros vinculados. */
export async function listLideres(): Promise<LiderRow[]> {
  await requireEquipesAccess()

  const [users, memberships] = await Promise.all([
    prisma.createdUser.findMany({
      where: { type: "Administrador" },
      select: { id: true, name: true, email: true, accessProfile: true },
    }),
    prisma.teamMembership.groupBy({
      by: ["leaderId"],
      _count: { id: true },
    }),
  ])

  const countMap = new Map(memberships.map((m) => [m.leaderId, m._count.id]))

  return users
    .filter((u) => isLeaderProfile(u.accessProfile))
    .map((u) => ({
      id: u.id,
      name: u.name ?? u.email,
      email: u.email,
      accessProfile: u.accessProfile as "QA" | "UX" | "TW",
      memberCount: countMap.get(u.id) ?? 0,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
}

/** Membros já vinculados ao líder. */
export async function getMembrosDoLider(leaderId: string): Promise<MembroVinculado[]> {
  await requireEquipesAccess()

  const memberships = await prisma.teamMembership.findMany({
    where: { leaderId },
    include: {
      member: { select: { id: true, name: true, email: true, accessProfile: true } },
    },
    orderBy: { createdAt: "asc" },
  })

  return memberships
    .filter((m) => isLeaderProfile(m.member.accessProfile))
    .map((m) => ({
      id: m.member.id,
      name: m.member.name ?? m.member.email,
      email: m.member.email,
      accessProfile: m.member.accessProfile as "QA" | "UX" | "TW",
      linkedAt: m.createdAt.toISOString(),
    }))
}

/** Usuários Padrão do mesmo perfil do líder que ainda não têm equipe. */
export async function listMembrosDisponiveis(leaderId: string): Promise<MembroDisponivel[]> {
  await requireEquipesAccess()

  const leader = await prisma.createdUser.findUnique({
    where: { id: leaderId },
    select: { type: true, accessProfile: true },
  })
  if (!leader || leader.type !== "Administrador" || !isLeaderProfile(leader.accessProfile)) {
    throw new Error("Líder inválido.")
  }

  const alreadyLinked = await prisma.teamMembership.findMany({
    select: { memberId: true },
  })
  const linkedIds = new Set(alreadyLinked.map((m) => m.memberId))

  const available = await prisma.createdUser.findMany({
    where: { type: "Padrão", accessProfile: leader.accessProfile },
    select: { id: true, name: true, email: true, accessProfile: true },
    orderBy: { name: "asc" },
  })

  return available
    .filter((u) => !linkedIds.has(u.id))
    .map((u) => ({
      id: u.id,
      name: u.name ?? u.email,
      email: u.email,
      accessProfile: u.accessProfile as "QA" | "UX" | "TW",
    }))
}

/** Vincula um membro a um líder. Valida perfil e unicidade. */
export async function addMembro(
  leaderId: string,
  memberId: string,
): Promise<{ error?: string }> {
  await requireEquipesAccess()

  const [leader, member] = await Promise.all([
    prisma.createdUser.findUnique({
      where: { id: leaderId },
      select: { type: true, accessProfile: true, name: true },
    }),
    prisma.createdUser.findUnique({
      where: { id: memberId },
      select: { type: true, accessProfile: true },
    }),
  ])

  if (!leader || leader.type !== "Administrador" || !isLeaderProfile(leader.accessProfile)) {
    return { error: "Líder inválido." }
  }
  if (!member || member.type !== "Padrão") {
    return { error: "Apenas usuários do tipo Padrão podem ser membros de equipe." }
  }
  if (member.accessProfile !== leader.accessProfile) {
    return { error: `Perfil incompatível. Este líder só aceita membros com perfil ${leader.accessProfile}.` }
  }

  const existing = await prisma.teamMembership.findUnique({
    where: { memberId },
    include: { leader: { select: { name: true } } },
  })
  if (existing) {
    const liderNome = existing.leader.name ?? "outro líder"
    return {
      error: `Este usuário já está vinculado à equipe de ${liderNome}. Remova-o da equipe atual antes de realizar uma nova vinculação.`,
    }
  }

  await prisma.teamMembership.create({
    data: { leaderId, memberId },
  })

  revalidatePath("/configuracoes/equipes")
  return {}
}

/** Remove o vínculo de um membro (por memberId). */
export async function removeMembro(memberId: string): Promise<{ error?: string }> {
  await requireEquipesAccess()

  const existing = await prisma.teamMembership.findUnique({ where: { memberId } })
  if (!existing) return { error: "Vínculo não encontrado." }

  await prisma.teamMembership.delete({ where: { memberId } })

  revalidatePath("/configuracoes/equipes")
  return {}
}

/**
 * Retorna os IDs dos membros vinculados ao líder.
 * Sem guard de role — uso interno pelos filtros de dados.
 */
export async function getTeamMemberIds(leaderId: string): Promise<string[]> {
  try {
    const memberships = await prisma.teamMembership.findMany({
      where: { leaderId },
      select: { memberId: true },
    })
    return memberships.map((m) => m.memberId)
  } catch {
    return []
  }
}
