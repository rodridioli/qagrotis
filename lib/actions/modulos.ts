"use server"

import { promises as fs } from "fs"
import path from "path"
import { revalidatePath } from "next/cache"
import { z } from "zod"

export interface ModuloRecord {
  id: string
  name: string
  description: string | null
  sistemaId: string
  sistemaName: string
  active: boolean
  createdAt?: number
}

const DATA_DIR = path.join(process.cwd(), "data")
const MODULOS_FILE = path.join(DATA_DIR, "modulos.json")

// ── Validation schemas ──────────────────────────────────────────────────────

const moduloInputSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(200),
  description: z.string().max(1000).nullable(),
  sistemaId: z.string().regex(/^SIS-\d+$/, "sistemaId inválido"),
  sistemaName: z.string().min(1).max(200),
})

const idSchema = z.string().regex(/^MOD-\d+$/, "ID inválido")
const idsArraySchema = z.array(idSchema).max(1000)

// ── Storage helpers ─────────────────────────────────────────────────────────

async function readModulos(): Promise<ModuloRecord[]> {
  try {
    const content = await fs.readFile(MODULOS_FILE, "utf-8")
    return JSON.parse(content) as ModuloRecord[]
  } catch {
    return []
  }
}

async function writeModulos(modulos: ModuloRecord[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true })
  await fs.writeFile(MODULOS_FILE, JSON.stringify(modulos, null, 2), "utf-8")
}

// ── Public actions ──────────────────────────────────────────────────────────

export async function getModulos(): Promise<ModuloRecord[]> {
  return readModulos()
}

export async function getModulo(id: string): Promise<ModuloRecord | null> {
  const result = idSchema.safeParse(id)
  if (!result.success) return null
  const modulos = await readModulos()
  return modulos.find((m) => m.id === id) ?? null
}

export async function criarModulo(data: {
  name: string
  description: string | null
  sistemaId: string
  sistemaName: string
}): Promise<ModuloRecord> {
  const parsed = moduloInputSchema.parse({
    name: data.name.trim(),
    description: data.description?.trim() || null,
    sistemaId: data.sistemaId,
    sistemaName: data.sistemaName.trim(),
  })

  const modulos = await readModulos()
  const nums = modulos
    .map((m) => parseInt(m.id.replace("MOD-", ""), 10))
    .filter((n) => !isNaN(n))
  const nextNum = nums.length > 0 ? Math.max(...nums) + 1 : 1
  const id = `MOD-${String(nextNum).padStart(2, "0")}`

  const novo: ModuloRecord = { id, ...parsed, active: true, createdAt: Date.now() }
  modulos.push(novo)
  await writeModulos(modulos)
  revalidatePath("/configuracoes/modulos")
  return novo
}

export async function atualizarModulo(
  id: string,
  data: { name: string; description: string | null; sistemaId: string; sistemaName: string }
): Promise<void> {
  idSchema.parse(id)
  const parsed = moduloInputSchema.parse({
    name: data.name.trim(),
    description: data.description?.trim() || null,
    sistemaId: data.sistemaId,
    sistemaName: data.sistemaName.trim(),
  })

  const modulos = await readModulos()
  const idx = modulos.findIndex((m) => m.id === id)
  if (idx === -1) return

  modulos[idx] = { ...modulos[idx], ...parsed }
  await writeModulos(modulos)
  revalidatePath("/configuracoes/modulos")
  revalidatePath(`/configuracoes/modulos/${id}/editar`)
}

export async function inativarModulos(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  idsArraySchema.parse(ids)

  const modulos = await readModulos()
  const idSet = new Set(ids)
  for (const modulo of modulos) {
    if (idSet.has(modulo.id)) modulo.active = false
  }
  await writeModulos(modulos)
  revalidatePath("/configuracoes/modulos")
}
