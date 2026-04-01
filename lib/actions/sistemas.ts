"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { nextId } from "@/lib/db-utils"
import { requireAdmin } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export interface SistemaRecord {
  id: string
  name: string
  description: string | null
  active: boolean
  createdAt?: number
}

// ── Validation schemas ──────────────────────────────────────────────────────

const sistemaInputSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(200),
  description: z.string().max(1000).nullable(),
})

const idSchema = z.string().regex(/^SIS-\d+$/, "ID inválido")
const idsArraySchema = z.array(idSchema).max(1000)

// ── Public actions ──────────────────────────────────────────────────────────

export async function getSistemas(): Promise<SistemaRecord[]> {
  const rows = await prisma.sistema.findMany({ orderBy: { createdAt: "asc" } })
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.getTime() }))
}

export async function getSistema(id: string): Promise<SistemaRecord | null> {
  const result = idSchema.safeParse(id)
  if (!result.success) return null
  const row = await prisma.sistema.findUnique({ where: { id } })
  return row ? { ...row, createdAt: row.createdAt.getTime() } : null
}

export async function getActiveSistemaNames(): Promise<string[]> {
  const rows = await prisma.sistema.findMany({
    where: { active: true },
    select: { name: true },
    orderBy: { name: "asc" },
  })
  return rows.map((r) => r.name)
}

export async function criarSistema(data: {
  name: string
  description: string | null
}): Promise<void> {
  await requireAdmin()
  const parsed = sistemaInputSchema.parse({
    name: data.name.trim(),
    description: data.description?.trim() || null,
  })

  const existing = await prisma.sistema.findMany({ select: { id: true } })
  const id = nextId(existing.map((s) => s.id), "SIS")

  await prisma.sistema.create({ data: { id, ...parsed, active: true } })
  revalidatePath("/configuracoes/sistemas")
}

export async function atualizarSistema(
  id: string,
  data: { name: string; description: string | null }
): Promise<void> {
  await requireAdmin()
  idSchema.parse(id)
  const parsed = sistemaInputSchema.parse({
    name: data.name.trim(),
    description: data.description?.trim() || null,
  })

  const existing = await prisma.sistema.findUnique({ where: { id }, select: { name: true } })
  if (!existing) return

  const oldName = existing.name

  // Update sistema + propagate rename atomically
  await prisma.$transaction([
    prisma.sistema.update({ where: { id }, data: parsed }),
    ...(oldName !== parsed.name
      ? [
          prisma.modulo.updateMany({ where: { sistemaId: id }, data: { sistemaName: parsed.name } }),
          prisma.cenario.updateMany({ where: { system: oldName }, data: { system: parsed.name } }),
        ]
      : []),
  ])

  revalidatePath("/configuracoes/sistemas")
  revalidatePath(`/configuracoes/sistemas/${id}`)
  revalidatePath(`/configuracoes/sistemas/${id}/editar`)
  if (oldName !== parsed.name) {
    revalidatePath("/configuracoes/modulos")
    revalidatePath("/cenarios")
  }
}

export async function inativarSistemas(ids: string[]): Promise<void> {
  await requireAdmin()
  if (ids.length === 0) return
  idsArraySchema.parse(ids)

  await prisma.sistema.updateMany({ where: { id: { in: ids } }, data: { active: false } })
  revalidatePath("/configuracoes/sistemas")
}
