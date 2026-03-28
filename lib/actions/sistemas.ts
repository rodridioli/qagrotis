"use server"

import { promises as fs } from "fs"
import path from "path"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { SYSTEM_LIST } from "@/lib/qagrotis-constants"

export interface SistemaRecord {
  id: string
  name: string
  description: string | null
  active: boolean
  createdAt?: number
}

const DATA_DIR = path.join(process.cwd(), "data")
const SISTEMAS_FILE = path.join(DATA_DIR, "sistemas.json")
const MODULOS_FILE  = path.join(DATA_DIR, "modulos.json")
const CENARIOS_FILE = path.join(DATA_DIR, "cenarios.json")

// ── Validation schemas ──────────────────────────────────────────────────────

const sistemaInputSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(200),
  description: z.string().max(1000).nullable(),
})

const idSchema = z.string().regex(/^SIS-\d+$/, "ID inválido")
const idsArraySchema = z.array(idSchema).max(1000)

// ── Storage helpers ─────────────────────────────────────────────────────────

async function readSistemas(): Promise<SistemaRecord[]> {
  try {
    const content = await fs.readFile(SISTEMAS_FILE, "utf-8")
    return JSON.parse(content) as SistemaRecord[]
  } catch {
    const seeded: SistemaRecord[] = SYSTEM_LIST.map((name, i) => ({
      id: `SIS-${String(i + 1).padStart(2, "0")}`,
      name,
      description: null,
      active: true,
    }))
    await writeSistemas(seeded)
    return seeded
  }
}

async function writeSistemas(sistemas: SistemaRecord[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true })
  await fs.writeFile(SISTEMAS_FILE, JSON.stringify(sistemas, null, 2), "utf-8")
}

// ── Public actions ──────────────────────────────────────────────────────────

export async function getSistemas(): Promise<SistemaRecord[]> {
  return readSistemas()
}

export async function getSistema(id: string): Promise<SistemaRecord | null> {
  const result = idSchema.safeParse(id)
  if (!result.success) return null
  const sistemas = await readSistemas()
  return sistemas.find((s) => s.id === id) ?? null
}

export async function getActiveSistemaNames(): Promise<string[]> {
  const sistemas = await readSistemas()
  return sistemas.filter((s) => s.active).map((s) => s.name)
}

export async function criarSistema(data: {
  name: string
  description: string | null
}): Promise<void> {
  const parsed = sistemaInputSchema.parse({
    name: data.name.trim(),
    description: data.description?.trim() || null,
  })

  const sistemas = await readSistemas()
  const nums = sistemas
    .map((s) => parseInt(s.id.replace("SIS-", ""), 10))
    .filter((n) => !isNaN(n))
  const nextNum = nums.length > 0 ? Math.max(...nums) + 1 : 1
  const id = `SIS-${String(nextNum).padStart(2, "0")}`

  sistemas.push({ id, ...parsed, active: true, createdAt: Date.now() })
  await writeSistemas(sistemas)
  revalidatePath("/configuracoes/sistemas")
}

export async function atualizarSistema(
  id: string,
  data: { name: string; description: string | null }
): Promise<void> {
  idSchema.parse(id)
  const parsed = sistemaInputSchema.parse({
    name: data.name.trim(),
    description: data.description?.trim() || null,
  })

  const sistemas = await readSistemas()
  const idx = sistemas.findIndex((s) => s.id === id)
  if (idx === -1) return

  const oldName = sistemas[idx].name
  sistemas[idx] = { ...sistemas[idx], ...parsed }
  await writeSistemas(sistemas)

  if (oldName !== parsed.name) {
    await propagateSistemaRename(id, oldName, parsed.name)
  }

  revalidatePath("/configuracoes/sistemas")
  revalidatePath(`/configuracoes/sistemas/${id}`)
  revalidatePath(`/configuracoes/sistemas/${id}/editar`)
}

async function propagateSistemaRename(
  sistemaId: string,
  oldName: string,
  newName: string,
): Promise<void> {
  // Update sistemaName in modulos
  try {
    const modulosRaw = await fs.readFile(MODULOS_FILE, "utf-8")
    const modulos = JSON.parse(modulosRaw) as Array<{ sistemaId: string; sistemaName: string; [key: string]: unknown }>
    let modChanged = false
    for (const m of modulos) {
      if (m.sistemaId === sistemaId) {
        m.sistemaName = newName
        modChanged = true
      }
    }
    if (modChanged) {
      await fs.writeFile(MODULOS_FILE, JSON.stringify(modulos, null, 2), "utf-8")
      revalidatePath("/configuracoes/modulos")
    }
  } catch {
    // modulos.json may not exist yet — nothing to propagate
  }

  // Update system field in cenarios
  try {
    const cenariosRaw = await fs.readFile(CENARIOS_FILE, "utf-8")
    const cenarios = JSON.parse(cenariosRaw) as Array<{ system: string; [key: string]: unknown }>
    let cenChanged = false
    for (const c of cenarios) {
      if (c.system === oldName) {
        c.system = newName
        cenChanged = true
      }
    }
    if (cenChanged) {
      await fs.writeFile(CENARIOS_FILE, JSON.stringify(cenarios, null, 2), "utf-8")
      revalidatePath("/cenarios")
    }
  } catch {
    // cenarios.json may not exist yet — nothing to propagate
  }
}

export async function inativarSistemas(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  idsArraySchema.parse(ids)

  const sistemas = await readSistemas()
  const idSet = new Set(ids)
  for (const sistema of sistemas) {
    if (idSet.has(sistema.id)) sistema.active = false
  }
  await writeSistemas(sistemas)
  revalidatePath("/configuracoes/sistemas")
}
