"use server"

import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { MOCK_USERS } from "@/lib/qagrotis-constants"

export interface LimparResult {
  cenarios: number
  suites: number
  modulos: number
  sistemas: number
  clientes: number
  integracoes: number
  usuarios: number
}

/**
 * Deletes ALL cenarios, suites, modulos and sistemas (active + inactive).
 * Clientes and integracoes: all (active + inactive).
 * Usuarios: only inactive createdUsers are removed; active users are kept.
 * Admin-only. Runs in FK-safe order.
 */
export async function limparRegistrosInativos(): Promise<LimparResult> {
  await requireAdmin()

  // ── Step 1: NULL all FK references before deleting ───────────────────────

  // NULL moduleId/sistemaId on cenarios and suites (they reference modulos/sistemas)
  await prisma.$transaction([
    prisma.cenario.updateMany({ data: { moduleId: null, systemId: null } }),
    prisma.suite.updateMany({ data: { moduloId: null, sistemaId: null } }),
  ])

  // ── Step 2: Delete ALL cenarios ─────────────────────────────────────────
  const { count: deletedCenarios } = await prisma.cenario.deleteMany({})

  // ── Step 3: Delete ALL suites ────────────────────────────────────────────
  const { count: deletedSuites } = await prisma.suite.deleteMany({})

  // ── Step 4: Delete ALL modulos ───────────────────────────────────────────
  const { count: deletedModulos } = await prisma.modulo.deleteMany({})

  // ── Step 5: Delete ALL sistemas ──────────────────────────────────────────
  const { count: deletedSistemas } = await prisma.sistema.deleteMany({})

  // ── Step 6: Delete ALL clientes ──────────────────────────────────────────
  const { count: deletedClientes } = await prisma.cliente.deleteMany({})

  // ── Step 7: Delete ALL integracoes ───────────────────────────────────────
  const { count: deletedIntegracoes } = await prisma.integracao.deleteMany({})

  // ── Step 8: Delete only INACTIVE createdUsers ────────────────────────────
  // Never touch MOCK_USERS — they live in code constants.
  // Active users (not in InactiveUser table) are kept.
  const mockUserIds = new Set(MOCK_USERS.map((u) => u.id))
  const inactiveUserRecords = await prisma.inactiveUser.findMany({ select: { userId: true } })
  const createdUsers = await prisma.createdUser.findMany({ select: { id: true } })
  const createdUserIds = new Set(createdUsers.map((u) => u.id))

  const inactiveCreatedUserIds = inactiveUserRecords
    .map((r) => r.userId)
    .filter((id) => createdUserIds.has(id) && !mockUserIds.has(id))

  let deletedUsuarios = 0
  if (inactiveCreatedUserIds.length > 0) {
    await prisma.$transaction([
      prisma.userProfile.deleteMany({ where: { userId: { in: inactiveCreatedUserIds } } }),
      prisma.inactiveUser.deleteMany({ where: { userId: { in: inactiveCreatedUserIds } } }),
      prisma.createdUser.deleteMany({ where: { id: { in: inactiveCreatedUserIds } } }),
    ])
    deletedUsuarios = inactiveCreatedUserIds.length
  }

  // ── Revalidate ───────────────────────────────────────────────────────────
  revalidatePath("/cenarios")
  revalidatePath("/suites")
  revalidatePath("/configuracoes/sistemas")
  revalidatePath("/configuracoes/modulos")
  revalidatePath("/configuracoes/clientes")
  revalidatePath("/configuracoes/integracoes")
  revalidatePath("/configuracoes/usuarios")
  revalidatePath("/dashboard")

  return {
    cenarios:    deletedCenarios,
    suites:      deletedSuites,
    modulos:     deletedModulos,
    sistemas:    deletedSistemas,
    clientes:    deletedClientes,
    integracoes: deletedIntegracoes,
    usuarios:    deletedUsuarios,
  }
}
