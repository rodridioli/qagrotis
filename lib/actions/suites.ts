"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requireSession } from "@/lib/session"
import { nextId } from "@/lib/db-utils"
import { prisma } from "@/lib/prisma"

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

// ── Mapping helper ──────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toRecord(row: any): SuiteRecord {
  return {
    id:        row.id,
    suiteName: row.suiteName,
    versao:    row.versao,
    sistema:   row.sistema,
    modulo:    row.modulo,
    cliente:   row.cliente,
    tipo:      row.tipo ?? "Sprint",
    objetivo:  row.objetivo,
    active:    row.active,
    createdAt: row.createdAt instanceof Date ? row.createdAt.getTime() : row.createdAt,
    cenarios:  (row.cenarios as unknown as SuiteRecord["cenarios"]) ?? [],
    historico: (row.historico as unknown as SuiteRecord["historico"]) ?? [],
  }
}

// ── Public actions ──────────────────────────────────────────────────────────

export interface SuiteListRecord extends Omit<SuiteRecord, "historico"> {
  historicoCount: number
  historicoErros: number
}

export async function getSuites(): Promise<SuiteListRecord[]> {
  const rows = await prisma.suite.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true, suiteName: true, versao: true, sistema: true,
      modulo: true, cliente: true, tipo: true, objetivo: true,
      active: true, createdAt: true, cenarios: true, historico: true,
    },
  })
  return rows.map((row) => {
    const historico = (row.historico as unknown as NonNullable<SuiteRecord["historico"]>) ?? []
    return {
      ...toRecord(row),
      historicoCount: historico.length,
      historicoErros: historico.filter((h) => h.resultado === "Erro").length,
      historico: undefined,
    }
  })
}

export async function getSuiteById(id: string): Promise<SuiteRecord | null> {
  if (!id || typeof id !== "string") return null
  const row = await prisma.suite.findUnique({ where: { id } })
  return row ? toRecord(row) : null
}

export async function criarSuite(data: unknown): Promise<SuiteRecord> {
  await requireSession()
  const parsed = suiteSchema.parse(data)
  const existing = await prisma.suite.findMany({ select: { id: true } })
  const id = nextId(existing.map((s) => s.id), "S", 4)

  // Lookup IDs by name for data integrity
  const [sysRow, modRow] = await Promise.all([
    prisma.sistema.findFirst({ where: { name: parsed.sistema, active: true }, select: { id: true } }),
    prisma.modulo.findFirst({ where: { name: parsed.modulo, sistemaName: parsed.sistema, active: true }, select: { id: true } })
  ])

  const row = await prisma.suite.create({
    data: {
      id,
      suiteName: parsed.suiteName,
      versao:    parsed.versao,
      sistema:   parsed.sistema,
      modulo:    parsed.modulo,
      sistemaId: sysRow?.id,
      moduloId:  modRow?.id,
      tipo:      parsed.tipo,
      cliente:   parsed.cliente,
      objetivo:  parsed.objetivo,
      active:    true,
      cenarios:  parsed.cenarios,
      historico: [],
    },
  })

  revalidatePath("/suites")
  return toRecord(row)
}

export async function atualizarSuite(id: string, data: unknown): Promise<SuiteRecord> {
  await requireSession()
  if (!id || typeof id !== "string") throw new Error("ID inválido")
  const parsed = suiteSchema.parse(data)

  const existing = await prisma.suite.findUnique({ where: { id }, select: { historico: true } })
  if (!existing) throw new Error("Suíte não encontrada")

  // Lookup IDs by name for data integrity update
  const [sysRow, modRow] = await Promise.all([
    prisma.sistema.findFirst({ where: { name: parsed.sistema, active: true }, select: { id: true } }),
    prisma.modulo.findFirst({ where: { name: parsed.modulo, sistemaName: parsed.sistema, active: true }, select: { id: true } })
  ])

  const row = await prisma.suite.update({
    where: { id },
    data: {
      suiteName: parsed.suiteName,
      versao:    parsed.versao,
      sistema:   parsed.sistema,
      modulo:    parsed.modulo,
      sistemaId: sysRow?.id,
      moduloId:  modRow?.id,
      tipo:      parsed.tipo,
      cliente:   parsed.cliente,
      objetivo:  parsed.objetivo,
      cenarios:  parsed.cenarios,
      // Preserve historico — do not overwrite
    },
  })

  revalidatePath("/suites")
  revalidatePath(`/suites/${id}`)
  return toRecord(row)
}

export async function registrarResultadoSuite(suiteId: string, cenarioId: string, resultado: "Sucesso" | "Erro"): Promise<void> {
  await requireSession()

  const suite = await prisma.suite.findUnique({ where: { id: suiteId } })
  if (!suite) throw new Error("Suíte não encontrada")

  const cenarios = suite.cenarios as unknown as SuiteRecord["cenarios"]
  const cenarioRef = cenarios.find((c) => c.id === cenarioId)
  if (!cenarioRef) throw new Error("Cenário não pertence à suíte")

  const now = new Date()
  const historicoItem = {
    id:       cenarioId,
    cenario:  cenarioRef.name,
    module:   cenarioRef.module,
    tipo:     cenarioRef.tipo,
    deps:     cenarioRef.deps,
    data:     now.toLocaleDateString("pt-BR"),
    hora:     now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    timestamp: now.getTime(),
    resultado,
  }

  const historico = (suite.historico as unknown as NonNullable<SuiteRecord["historico"]>) ?? []
  historico.push(historicoItem)

  await prisma.suite.update({ where: { id: suiteId }, data: { historico } })
  revalidatePath("/suites")
  revalidatePath(`/suites/${suiteId}`)
}

// ── Dashboard-specific: minimal record with full historico ──────────────────

export interface SuiteDashboardRecord {
  id: string
  sistema: string
  modulo: string
  historico: NonNullable<SuiteRecord["historico"]>
}

export async function getSuitesParaDashboard(): Promise<SuiteDashboardRecord[]> {
  const rows = await prisma.suite.findMany({
    select: { id: true, sistema: true, modulo: true, historico: true },
  })
  return rows.map((row) => ({
    id:       row.id,
    sistema:  row.sistema,
    modulo:   row.modulo,
    historico: (row.historico as unknown as NonNullable<SuiteRecord["historico"]>) ?? [],
  }))
}

export async function inativarSuites(ids: string[]): Promise<void> {
  await requireSession()
  if (!Array.isArray(ids) || ids.length === 0) return
  await prisma.suite.updateMany({ where: { id: { in: ids } }, data: { active: false } })
  revalidatePath("/suites")
}

export async function removerHistoricoSuite(suiteId: string, indices: number[]): Promise<void> {
  await requireSession()
  if (!suiteId || typeof suiteId !== "string") throw new Error("ID de suíte inválido")
  if (!Array.isArray(indices) || indices.some((i) => !Number.isInteger(i) || i < 0))
    throw new Error("Índices inválidos")

  const suite = await prisma.suite.findUnique({ where: { id: suiteId } })
  if (!suite) throw new Error("Suíte não encontrada")

  const historico = (suite.historico as unknown as NonNullable<SuiteRecord["historico"]>) ?? []
  if (historico.length === 0) return

  const indexSet = new Set(indices)
  const updated = historico.filter((_, i) => !indexSet.has(i))

  await prisma.suite.update({ where: { id: suiteId }, data: { historico: updated } })
  revalidatePath("/suites")
  revalidatePath(`/suites/${suiteId}`)
}
