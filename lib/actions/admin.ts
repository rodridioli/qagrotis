"use server"

import { revalidatePath, revalidateTag } from "next/cache"
import { requireAdmin } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { LAYOUT_CACHE_TAG } from "@/lib/layout-cache"

export interface LimparResult {
  cenarios: number
  suites: number
  modulos: number
  sistemas: number
  clientes: number
}

/**
 * Deletes ALL cenarios, suites, modulos, sistemas and clientes (active + inactive).
 * KEEPS: usuários (todos), modelos de IA (integracoes), configuração Jira (localStorage).
 * Admin-only. Runs in FK-safe order.
 */
export async function limparRegistrosInativos(): Promise<LimparResult> {
  await requireAdmin()

  // ── Step 1: NULL FK refs on cenarios/suites before deleting modulos/sistemas ─
  await prisma.$transaction([
    prisma.cenario.updateMany({ data: { moduleId: null, systemId: null } }),
    prisma.suite.updateMany({ data: { moduloId: null, sistemaId: null } }),
  ])

  // ── Step 2: Delete ALL cenarios ──────────────────────────────────────────────
  const { count: deletedCenarios } = await prisma.cenario.deleteMany({})

  // ── Step 3: Delete ALL suites ────────────────────────────────────────────────
  const { count: deletedSuites } = await prisma.suite.deleteMany({})

  // ── Step 4: Delete ALL modulos ───────────────────────────────────────────────
  const { count: deletedModulos } = await prisma.modulo.deleteMany({})

  // ── Step 5: Delete ALL sistemas ──────────────────────────────────────────────
  const { count: deletedSistemas } = await prisma.sistema.deleteMany({})

  // ── Step 6: Delete ALL clientes ──────────────────────────────────────────────
  const { count: deletedClientes } = await prisma.cliente.deleteMany({})

  // ── Revalidate ───────────────────────────────────────────────────────────────
  revalidateTag(LAYOUT_CACHE_TAG)   // invalidate sidebar menu cache immediately
  revalidatePath("/cenarios")
  revalidatePath("/suites")
  revalidatePath("/configuracoes/sistemas")
  revalidatePath("/configuracoes/modulos")
  revalidatePath("/configuracoes/clientes")
  revalidatePath("/dashboard")
  revalidatePath("/configuracoes")

  return {
    cenarios: deletedCenarios,
    suites:   deletedSuites,
    modulos:  deletedModulos,
    sistemas: deletedSistemas,
    clientes: deletedClientes,
  }
}
