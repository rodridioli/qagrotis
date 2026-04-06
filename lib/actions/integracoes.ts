"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { nextId } from "@/lib/db-utils"
import { requireAdmin } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export interface IntegracaoRecord {
  id: string
  descricao: string
  provider: "google" | "openai" | "anthropic" | "groq" | "openrouter"
  model: string
  apiKey: string
  active: boolean
  createdAt: number
}

const integracaoSchema = z.object({
  descricao: z.string().max(200, "Máximo de 200 caracteres").optional().default(""),
  provider:  z.enum(["google", "openai", "anthropic", "groq", "openrouter"]),
  model:     z.string().min(1, "Modelo é obrigatório"),
  apiKey:    z.string().min(1, "API Key é obrigatória"),
})

const idSchema = z.string().regex(/^INT-\d+$/, "ID inválido")
const idsArraySchema = z.array(idSchema).max(1000)

// ── Public actions ──────────────────────────────────────────────────────────

export async function getIntegracoes(): Promise<IntegracaoRecord[]> {
  const rows = await prisma.integracao.findMany({ orderBy: { createdAt: "asc" } })
  return rows.map((r) => ({
    ...r,
    provider: r.provider as IntegracaoRecord["provider"],
    createdAt: r.createdAt.getTime(),
  }))
}

export async function getIntegracao(id: string): Promise<IntegracaoRecord | null> {
  const result = idSchema.safeParse(id)
  if (!result.success) return null
  const row = await prisma.integracao.findUnique({ where: { id } })
  if (!row) return null
  return { ...row, provider: row.provider as IntegracaoRecord["provider"], createdAt: row.createdAt.getTime() }
}

export async function criarIntegracao(data: unknown): Promise<void> {
  await requireAdmin()
  const parsed = integracaoSchema.parse(data)
  const existing = await prisma.integracao.findMany({ select: { id: true } })
  const id = nextId(existing.map((i) => i.id), "INT")

  await prisma.integracao.create({ data: { id, ...parsed, active: true } })
  revalidatePath("/configuracoes/integracoes")
  revalidatePath("/gerador")
  revalidatePath("/(protected)", "layout")
}

export async function atualizarIntegracao(id: string, data: unknown): Promise<void> {
  await requireAdmin()
  idSchema.parse(id)
  const parsed = integracaoSchema.parse(data)

  const existing = await prisma.integracao.findUnique({ where: { id }, select: { id: true } })
  if (!existing) throw new Error("Integração não encontrada")

  await prisma.integracao.update({ where: { id }, data: parsed })
  revalidatePath("/configuracoes/integracoes")
  revalidatePath(`/configuracoes/integracoes/${id}/editar`)
  revalidatePath("/gerador")
  revalidatePath("/(protected)", "layout")
}

export async function inativarIntegracoes(ids: string[]): Promise<void> {
  await requireAdmin()
  if (ids.length === 0) return
  idsArraySchema.parse(ids)

  await prisma.integracao.updateMany({ where: { id: { in: ids } }, data: { active: false } })
  revalidatePath("/configuracoes/integracoes")
  revalidatePath("/gerador")
  revalidatePath("/(protected)", "layout")
}
