"use server"

import { revalidatePath, revalidateTag } from "next/cache"
import { LAYOUT_CACHE_TAG } from "@/lib/layout-cache"
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
 *
 * FK constraint note: Modulo.sistemaId is non-nullable → FK RESTRICT.
 * Before deleting inactive Sistemas, we must delete ALL their Modulos
 * (active or inactive) to avoid FK violations from inconsistent data.
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

  // Inactive CreatedUsers: only those whose ID appears in InactiveUser table.
  // Never touch MOCK_USERS — they live in code constants and can't be DB-deleted.
  const mockUserIds    = new Set(MOCK_USERS.map((u) => u.id))
  const createdUserIds = new Set(createdUsers.map((u) => u.id))
  const inactiveCreatedUserIds = inactiveUserRecords
    .map((r) => r.userId)
    .filter((id) => createdUserIds.has(id) && !mockUserIds.has(id))

  // ── Step 1: NULL FK on Cenarios/Suites → inactive Modulos ───────────────
  // (covers both active and inactive records that reference these Modulos)

  if (moduloIds.length > 0) {
    await prisma.$transaction([
      prisma.cenario.updateMany({ where: { moduleId: { in: moduloIds } }, data: { moduleId: null } }),
      prisma.suite.updateMany({ where: { moduloId: { in: moduloIds } }, data: { moduloId: null } }),
    ])
  }

  // ── Step 2: Delete inactive Cenarios ────────────────────────────────────

  let deletedCenarios = 0
  if (cenarioIds.length > 0) {
    const r = await prisma.cenario.deleteMany({ where: { id: { in: cenarioIds } } })
    deletedCenarios = r.count
  }

  // ── Step 3: Delete inactive Suites ──────────────────────────────────────

  let deletedSuites = 0
  if (suiteIds.length > 0) {
    const r = await prisma.suite.deleteMany({ where: { id: { in: suiteIds } } })
    deletedSuites = r.count
  }

  // ── Step 4: Delete inactive Modulos ─────────────────────────────────────

  let deletedModulos = 0
  if (moduloIds.length > 0) {
    const r = await prisma.modulo.deleteMany({ where: { id: { in: moduloIds } } })
    deletedModulos = r.count
  }

  // ── Step 5: NULL FK on Cenarios/Suites → inactive Sistemas ──────────────

  if (sistemaIds.length > 0) {
    await prisma.$transaction([
      prisma.cenario.updateMany({ where: { systemId: { in: sistemaIds } }, data: { systemId: null } }),
      prisma.suite.updateMany({ where: { sistemaId: { in: sistemaIds } }, data: { sistemaId: null } }),
    ])
  }

  // ── Step 6: Delete ALL Modulos of inactive Sistemas ─────────────────────
  // Modulo.sistemaId is non-nullable (FK RESTRICT). Any Modulo — active or
  // inactive — still referencing an inactive Sistema must be removed first.
  // This covers data-inconsistency edge cases where cascade didn't fire.

  if (sistemaIds.length > 0) {
    // First NULL their FK pointers from Cenarios/Suites
    const residualModulos = await prisma.modulo.findMany({
      where: { sistemaId: { in: sistemaIds } },
      select: { id: true },
    })
    const residualIds = residualModulos.map((m) => m.id)
    if (residualIds.length > 0) {
      await prisma.$transaction([
        prisma.cenario.updateMany({ where: { moduleId: { in: residualIds } }, data: { moduleId: null } }),
        prisma.suite.updateMany({ where: { moduloId: { in: residualIds } }, data: { moduloId: null } }),
        prisma.modulo.deleteMany({ where: { id: { in: residualIds } } }),
      ])
      deletedModulos += residualIds.length
    }
  }

  // ── Step 7: Delete inactive Sistemas ────────────────────────────────────

  let deletedSistemas = 0
  if (sistemaIds.length > 0) {
    const r = await prisma.sistema.deleteMany({ where: { id: { in: sistemaIds } } })
    deletedSistemas = r.count
  }

  // ── Step 8: Delete inactive Clientes ────────────────────────────────────

  let deletedClientes = 0
  if (clienteIds.length > 0) {
    const r = await prisma.cliente.deleteMany({ where: { id: { in: clienteIds } } })
    deletedClientes = r.count
  }

  // ── Step 9: Delete inactive Integracoes ─────────────────────────────────

  let deletedIntegracoes = 0
  if (integracaoIds.length > 0) {
    const r = await prisma.integracao.deleteMany({ where: { id: { in: integracaoIds } } })
    deletedIntegracoes = r.count
  }

  // ── Step 10: Delete inactive CreatedUsers ───────────────────────────────

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
