"use server"

import { promises as fs } from "fs"
import path from "path"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { writeFileAtomic, nextId } from "@/lib/db-utils"
import { requireAdmin } from "@/lib/session"

export interface IntegracaoRecord {
  id: string
  descricao: string
  apiKey: string
  active: boolean
  createdAt: number
}

const DATA_DIR = path.join(process.cwd(), "data")
const INTEGRACOES_FILE = path.join(DATA_DIR, "integracoes.json")

const integracaoSchema = z.object({
  descricao: z.string().min(1, "Descrição é obrigatória").max(200, "Máximo de 200 caracteres"),
  apiKey: z.string().min(1, "API Key é obrigatória"),
})

const idSchema = z.string().regex(/^INT-\d+$/, "ID inválido")
const idsArraySchema = z.array(idSchema).max(1000)

async function readIntegracoes(): Promise<IntegracaoRecord[]> {
  try {
    const content = await fs.readFile(INTEGRACOES_FILE, "utf-8")
    return JSON.parse(content) as IntegracaoRecord[]
  } catch {
    await writeIntegracoes([])
    return []
  }
}

async function writeIntegracoes(integracoes: IntegracaoRecord[]): Promise<void> {
  await writeFileAtomic(INTEGRACOES_FILE, JSON.stringify(integracoes, null, 2))
}

export async function getIntegracoes(): Promise<IntegracaoRecord[]> {
  return readIntegracoes()
}

export async function getIntegracao(id: string): Promise<IntegracaoRecord | null> {
  const result = idSchema.safeParse(id)
  if (!result.success) return null
  const integracoes = await readIntegracoes()
  return integracoes.find((i) => i.id === id) ?? null
}

export async function criarIntegracao(data: unknown): Promise<void> {
  await requireAdmin()
  const parsed = integracaoSchema.parse(data)
  const integracoes = await readIntegracoes()
  const id = nextId(integracoes.map((i) => i.id), "INT")

  integracoes.push({ id, ...parsed, active: true, createdAt: Date.now() })
  await writeIntegracoes(integracoes)
  revalidatePath("/configuracoes/integracoes")
}

export async function atualizarIntegracao(id: string, data: unknown): Promise<void> {
  await requireAdmin()
  idSchema.parse(id)
  const parsed = integracaoSchema.parse(data)
  const integracoes = await readIntegracoes()
  const idx = integracoes.findIndex((i) => i.id === id)
  if (idx === -1) throw new Error("Integração não encontrada")
  integracoes[idx] = { ...integracoes[idx], ...parsed }
  await writeIntegracoes(integracoes)
  revalidatePath("/configuracoes/integracoes")
  revalidatePath(`/configuracoes/integracoes/${id}/editar`)
}

export async function inativarIntegracoes(ids: string[]): Promise<void> {
  await requireAdmin()
  if (ids.length === 0) return
  idsArraySchema.parse(ids)
  const integracoes = await readIntegracoes()
  const idSet = new Set(ids)
  for (const i of integracoes) {
    if (idSet.has(i.id)) i.active = false
  }
  await writeIntegracoes(integracoes)
  revalidatePath("/configuracoes/integracoes")
}
