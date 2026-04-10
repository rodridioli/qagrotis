"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { nextId } from "@/lib/db-utils"
import { requireAdmin } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export interface ModuloRecord {
  id: string
  name: string
  description: string | null
  sistemaId: string
  sistemaName: string
  active: boolean
  createdAt?: number
}

// ── Validation schemas ──────────────────────────────────────────────────────

const moduloInputSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(200),
  description: z.string().max(1000).nullable(),
  sistemaId: z.string().regex(/^SIS-\d+$/, "sistemaId inválido"),
  sistemaName: z.string().min(1).max(200),
})

const idSchema = z.string().regex(/^MOD-\d+$/, "ID inválido")
const idsArraySchema = z.array(idSchema).max(1000)

// ── Public actions ──────────────────────────────────────────────────────────

export async function getModulos(): Promise<ModuloRecord[]> {
  const rows = await prisma.modulo.findMany({ orderBy: { createdAt: "asc" } })
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.getTime() }))
}

export async function getModulo(id: string): Promise<ModuloRecord | null> {
  const result = idSchema.safeParse(id)
  if (!result.success) return null
  const row = await prisma.modulo.findUnique({ where: { id } })
  return row ? { ...row, createdAt: row.createdAt.getTime() } : null
}

export async function criarModulo(data: {
  name: string
  description: string | null
  sistemaId: string
  sistemaName: string
}): Promise<ModuloRecord> {
  await requireAdmin()
  const parsed = moduloInputSchema.parse({
    name: data.name.trim(),
    description: data.description?.trim() || null,
    sistemaId: data.sistemaId,
    sistemaName: data.sistemaName.trim(),
  })

  const existing = await prisma.modulo.findMany({ select: { id: true } })
  const id = nextId(existing.map((m) => m.id), "MOD")

  const row = await prisma.modulo.create({ data: { id, ...parsed, active: true } })
  revalidatePath("/configuracoes/modulos")
  revalidatePath("/cenarios")
  revalidatePath("/cenarios/novo")
  revalidatePath("/suites")
  revalidatePath("/suites/nova")
  revalidatePath("/gerador")
  return { ...row, createdAt: row.createdAt.getTime() }
}

export async function atualizarModulo(
  id: string,
  data: { name: string; description: string | null; sistemaId: string; sistemaName: string }
): Promise<void> {
  await requireAdmin()
  idSchema.parse(id)
  const parsed = moduloInputSchema.parse({
    name: data.name.trim(),
    description: data.description?.trim() || null,
    sistemaId: data.sistemaId,
    sistemaName: data.sistemaName.trim(),
  })

  const existing = await prisma.modulo.findUnique({ where: { id }, select: { name: true } })
  if (!existing) return

  const oldName = existing.name

  // Propagate rename to cenarios and suites atomically
  await prisma.$transaction([
    prisma.modulo.update({ where: { id }, data: parsed }),
    ...(oldName !== parsed.name
      ? [
          prisma.cenario.updateMany({ where: { module: oldName }, data: { module: parsed.name } }),
          prisma.suite.updateMany({ where: { modulo: oldName }, data: { modulo: parsed.name } }),
        ]
      : []),
  ])

  revalidatePath("/configuracoes/modulos")
  revalidatePath(`/configuracoes/modulos/${id}/editar`)
  revalidatePath("/cenarios")
  revalidatePath("/cenarios/novo")
  revalidatePath("/suites")
  revalidatePath("/suites/nova")
  revalidatePath("/gerador")
}

export async function inativarModulos(ids: string[]): Promise<void> {
  await requireAdmin()
  if (ids.length === 0) return
  idsArraySchema.parse(ids)

  // Busca os módulos para propagar inativação aos cenários vinculados
  const modulos = await prisma.modulo.findMany({
    where: { id: { in: ids } },
    select: { name: true, sistemaName: true },
  })

  await prisma.$transaction([
    prisma.modulo.updateMany({ where: { id: { in: ids } }, data: { active: false } }),
    ...modulos.map((m) =>
      prisma.cenario.updateMany({
        where: { module: m.name, system: m.sistemaName },
        data: { active: false },
      })
    ),
    ...modulos.map((m) =>
      prisma.suite.updateMany({
        where: { modulo: m.name, sistema: m.sistemaName },
        data: { active: false },
      })
    ),
  ])

  revalidatePath("/configuracoes/modulos")
  revalidatePath("/cenarios")
  revalidatePath("/cenarios/novo")
  revalidatePath("/suites")
  revalidatePath("/suites/nova")
  revalidatePath("/gerador")
}
