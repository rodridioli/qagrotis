"use server"

import { promises as fs } from "fs"
import path from "path"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requireSession } from "@/lib/session"
import { writeFileAtomic, nextId } from "@/lib/db-utils"

export interface SuiteRecord {
  id: string
  suiteName: string
  versao: string
  sistema: string
  modulo: string
  cliente: string
  tipo: string
  objetivo: string | null
  active: boolean
  createdAt: number
  cenarios: {
    id: string
    name: string
    module: string
    execucoes: number
    erros: number
    deps: number
    tipo: string
  }[]
  historico?: {
    id: string
    cenario: string
    module: string
    tipo: string
    deps: number
    data: string
    hora?: string
    timestamp?: number
    resultado: "Sucesso" | "Erro" | "Pendente"
  }[]
}

const DATA_DIR = path.join(process.cwd(), "data")
const SUITES_FILE = path.join(DATA_DIR, "suites.json")

const suiteSchema = z.object({
  suiteName: z.string().min(1, "Nome da suíte é obrigatório").max(200),
  versao: z.string().min(1, "Versão é obrigatória").max(100),
  sistema: z.string().min(1, "Sistema é obrigatório").max(200),
  modulo: z.string().min(1, "Módulo é obrigatório").max(200),
  tipo: z.enum(["Sprint", "Kanban", "Outro"], { message: "Tipo é obrigatório" }),
  cliente: z.string().max(200),
  objetivo: z.string().max(2000).nullable(),
  cenarios: z.array(z.object({
    id: z.string(),
    name: z.string(),
    module: z.string(),
    execucoes: z.number(),
    erros: z.number(),
    deps: z.number(),
    tipo: z.string(),
  })).min(1, "Pelo menos um cenário é obrigatório"),
})

async function readSuites(): Promise<SuiteRecord[]> {
  try {
    const content = await fs.readFile(SUITES_FILE, "utf-8")
    const raw: any[] = JSON.parse(content)
    // Normalise legacy records that may not have `tipo`
    return raw.map((s) => ({ tipo: "Sprint", ...s })) as SuiteRecord[]
  } catch {
    // File missing — start with empty list
    await writeSuites([])
    return []
  }
}

async function writeSuites(suites: SuiteRecord[]): Promise<void> {
  await writeFileAtomic(SUITES_FILE, JSON.stringify(suites, null, 2))
}

export async function getSuites(): Promise<SuiteRecord[]> {
  return readSuites()
}

export async function getSuiteById(id: string): Promise<SuiteRecord | null> {
  if (!id || typeof id !== "string") return null
  const suites = await readSuites()
  return suites.find((s) => s.id === id) ?? null
}

export async function criarSuite(data: unknown): Promise<SuiteRecord> {
  await requireSession()
  const parsed = suiteSchema.parse(data)
  const suites = await readSuites()
  const id = nextId(suites.map((s) => s.id), "S", 4)

  const nova: SuiteRecord = {
    id,
    ...parsed,
    active: true,
    createdAt: Date.now(),
  }

  suites.push(nova)
  await writeSuites(suites)
  revalidatePath("/suites")
  return nova
}

export async function atualizarSuite(id: string, data: unknown): Promise<SuiteRecord> {
  await requireSession()
  if (!id || typeof id !== "string") throw new Error("ID inválido")
  const parsed = suiteSchema.parse(data)
  const suites = await readSuites()
  const idx = suites.findIndex((s) => s.id === id)
  if (idx === -1) throw new Error("Suíte não encontrada")

  suites[idx] = {
    ...suites[idx],
    ...parsed,
  }

  await writeSuites(suites)
  revalidatePath("/suites")
  revalidatePath(`/suites/${id}`)
  return suites[idx]
}

export async function registrarResultadoSuite(suiteId: string, cenarioId: string, resultado: "Sucesso" | "Erro"): Promise<void> {
  await requireSession()
  const suites = await readSuites()
  const suiteIdx = suites.findIndex((s) => s.id === suiteId)
  if (suiteIdx === -1) throw new Error("Suíte não encontrada")
  
  const suite = suites[suiteIdx]
  const cenarioRef = suite.cenarios.find((c) => c.id === cenarioId)
  if (!cenarioRef) throw new Error("Cenário não pertence à suíte")

  const now = new Date()
  const historicoItem = {
    id: cenarioId,
    cenario: cenarioRef.name,
    module: cenarioRef.module,
    tipo: cenarioRef.tipo,
    deps: cenarioRef.deps,
    data: now.toLocaleDateString("pt-BR"),
    hora: now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    timestamp: now.getTime(),
    resultado
  }

  suite.historico = suite.historico || []
  suite.historico.push(historicoItem)

  await writeSuites(suites)
  revalidatePath("/suites")
  revalidatePath(`/suites/${suiteId}`)
}

export async function removerHistoricoSuite(suiteId: string, indices: number[]): Promise<void> {
  await requireSession()
  if (!suiteId || typeof suiteId !== "string") throw new Error("ID de suíte inválido")
  if (!Array.isArray(indices) || indices.some((i) => !Number.isInteger(i) || i < 0))
    throw new Error("Índices inválidos")

  const suites = await readSuites()
  const suiteIdx = suites.findIndex((s) => s.id === suiteId)
  if (suiteIdx === -1) throw new Error("Suíte não encontrada")

  const suite = suites[suiteIdx]
  if (!suite.historico || suite.historico.length === 0) return

  const indexSet = new Set(indices)
  suite.historico = suite.historico.filter((_, i) => !indexSet.has(i))

  await writeSuites(suites)
  revalidatePath("/suites")
  revalidatePath(`/suites/${suiteId}`)
}
