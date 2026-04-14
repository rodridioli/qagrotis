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
 * Hard-deletes all inactive records from every entity.
 * Admin-only. Runs in FK-safe order.
 */
export async function limparRegistrosInativos(): Promise<LimparResult> {
  await requireAdmin()

  // ── Collect inactive IDs ─────────────────────────────────────────────────

  const [
    inactiveCenarios,
    inactiveSuites,
    inactiveModulos,
    inactiveSistemas,
    inactiveClientes,
    inactiveIntegracoes,
    inactiveUserRecords,
    createdUsers,
  ] = await Promise.all([
    prisma.cenario.findMany({ where: { active: false }, select: { id: true } }),
    prisma.suite.findMany({ where: { active: false }, select: { id: true } }),
    prisma.modulo.findMany({ where: { active: false }, select: { id: true } }),
    prisma.sistema.findMany({ where: { active: false }, select: { id: true } }),
    prisma.cliente.findMany({ where: { active: false }, select: { id: true } }),
    prisma.integracao.findMany({ where: { active: false }, select: { id: true } }),
    prisma.inactiveUser.findMany({ select: { userId: true } }),
    prisma.createdUser.findMany({ select: { id: true } }),
  ])

  const cenarioIds    = inactiveCenarios.map((r) => r.id)
  const suiteIds      = inactiveSuites.map((r) => r.id)
  const moduloIds     = inactiveModulos.map((r) => r.id)
  const sistemaIds    = inactiveSistemas.map((r) => r.id)
  const clienteIds    = inactiveClientes.map((r) => r.id)
  const integracaoIds = inactiveIntegracoes.map((r) => r.id)

  // Inactive CreatedUsers: only those whose ID appears in InactiveUser table
  // (never touch MOCK_USERS, they are managed by constants)
  const mockUserIds    = new Set(MOCK_USERS.map((u) => u.id))
  const createdUserIds = new Set(createdUsers.map((u) => u.id))
  const inactiveCreatedUserIds = inactiveUserRecords
    .map((r) => r.userId)
    .filter((id) => createdUserIds.has(id) && !mockUserIds.has(id))

  // ── Step 1: NULL FK on Cenarios/Suites pointing to inactive Modulos ───────

  if (moduloIds.length > 0) {
    await prisma.$transaction([
      prisma.cenario.updateMany({
        where: { moduleId: { in: moduloIds } },
        data: { moduleId: null },
      }),
      prisma.suite.updateMany({
        where: { moduloId: { in: moduloIds } },
        data: { moduloId: null },
      }),
    ])
  }

  // ── Step 2: Delete inactive Cenarios ────────────────────────────────────

  let deletedCenarios = 0
  if (cenarioIds.length > 0) {
    const result = await prisma.cenario.deleteMany({
      where: { id: { in: cenarioIds } },
    })
    deletedCenarios = result.count
  }

  // ── Step 3: Delete inactive Suites ──────────────────────────────────────

  let deletedSuites = 0
  if (suiteIds.length > 0) {
    const result = await prisma.suite.deleteMany({
      where: { id: { in: suiteIds } },
    })
    deletedSuites = result.count
  }

  // ── Step 4: Delete inactive Modulos ─────────────────────────────────────

  let deletedModulos = 0
  if (moduloIds.length > 0) {
    const result = await prisma.modulo.deleteMany({
      where: { id: { in: moduloIds } },
    })
    deletedModulos = result.count
  }

  // ── Step 5: NULL FK on Cenarios/Suites pointing to inactive Sistemas ─────

  if (sistemaIds.length > 0) {
    await prisma.$transaction([
      prisma.cenario.updateMany({
        where: { systemId: { in: sistemaIds } },
        data: { systemId: null },
      }),
      prisma.suite.updateMany({
        where: { sistemaId: { in: sistemaIds } },
        data: { sistemaId: null },
      }),
    ])
  }

  // ── Step 6: Delete inactive Sistemas ────────────────────────────────────

  let deletedSistemas = 0
  if (sistemaIds.length > 0) {
    const result = await prisma.sistema.deleteMany({
      where: { id: { in: sistemaIds } },
    })
    deletedSistemas = result.count
  }

  // ── Step 7: Delete inactive Clientes ────────────────────────────────────

  let deletedClientes = 0
  if (clienteIds.length > 0) {
    const result = await prisma.cliente.deleteMany({
      where: { id: { in: clienteIds } },
    })
    deletedClientes = result.count
  }

  // ── Step 8: Delete inactive Integracoes ─────────────────────────────────

  let deletedIntegracoes = 0
  if (integracaoIds.length > 0) {
    const result = await prisma.integracao.deleteMany({
      where: { id: { in: integracaoIds } },
    })
    deletedIntegracoes = result.count
  }

  // ── Step 9: Delete inactive CreatedUsers ────────────────────────────────

  let deletedUsuarios = 0
  if (inactiveCreatedUserIds.length > 0) {
    await prisma.$transaction([
      prisma.userProfile.deleteMany({
        where: { userId: { in: inactiveCreatedUserIds } },
      }),
      prisma.inactiveUser.deleteMany({
        where: { userId: { in: inactiveCreatedUserIds } },
      }),
      prisma.createdUser.deleteMany({
        where: { id: { in: inactiveCreatedUserIds } },
      }),
    ])
    deletedUsuarios = inactiveCreatedUserIds.length
  }

  // ── Revalidate ───────────────────────────────────────────────────────────

  revalidatePath("/(protected)", "layout")
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
