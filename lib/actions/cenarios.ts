"use server"

import { promises as fs } from "fs"
import path from "path"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { MOCK_CENARIOS } from "@/lib/qagrotis-constants"
import { auth } from "@/lib/auth"
import { requireSession } from "@/lib/session"
import { writeFileAtomic, nextId } from "@/lib/db-utils"

export interface CenarioStep {
  acao: string
  resultado: string
}

export interface CenarioRecord {
  id: string
  scenarioName: string
  system: string
  module: string
  client: string
  execucoes: number
  erros: number
  suites: number
  tipo: string
  active: boolean
  // Optional fields — only present in records created via the form
  createdAt?: number
  risco?: string
  regraDeNegocio?: string
  descricao?: string
  caminhoTela?: string
  preCondicoes?: string
  bdd?: string
  resultadoEsperado?: string
  urlScript?: string
  usuarioTeste?: string
  senhaTeste?: string
  senhaFalsa?: string
  steps?: CenarioStep[]
  deps?: string[]
  createdBy?: string
}

const DATA_DIR = path.join(process.cwd(), "data")
const CENARIOS_FILE = path.join(DATA_DIR, "cenarios.json")

// ── Validation schemas ──────────────────────────────────────────────────────

// Cenário IDs are free-form (CT-001, CT-002, etc.) from mock data
const idSchema = z.string().min(1).max(50).regex(/^[A-Z]+-\d+$/, "ID inválido")
const idsArraySchema = z.array(idSchema).max(2000)

const cenarioCreateSchema = z.object({
  scenarioName:      z.string().min(1, "Nome do cenário é obrigatório").max(500),
  system:            z.string().min(1).max(200),
  module:            z.string().min(1, "Módulo é obrigatório").max(200),
  client:            z.string().max(200),
  risco:             z.string().min(1, "Risco é obrigatório").max(50),
  regraDeNegocio:    z.string().min(1, "Regra de Negócio é obrigatória").max(5000),
  descricao:         z.string().min(1, "Descrição é obrigatória").max(5000),
  caminhoTela:       z.string().max(1000),
  preCondicoes:      z.string().max(5000),
  bdd:               z.string().max(5000),
  resultadoEsperado: z.string().min(1, "Resultado Esperado é obrigatório").max(5000),
  tipo:              z.enum(["Manual", "Automatizado", "Man./Auto."]),
  urlScript:         z.string().max(1000),
  usuarioTeste:      z.string().max(200),
  senhaTeste:        z.string().max(200),
  senhaFalsa:        z.string().max(200),
  steps:             z.array(z.object({ acao: z.string().min(1).max(1000), resultado: z.string().min(1).max(1000) })).max(100),
  deps:              z.array(idSchema).max(100),
})

// ── Storage helpers ─────────────────────────────────────────────────────────

async function readCenarios(): Promise<CenarioRecord[]> {
  try {
    const content = await fs.readFile(CENARIOS_FILE, "utf-8")
    return JSON.parse(content) as CenarioRecord[]
  } catch {
    const seeded: CenarioRecord[] = MOCK_CENARIOS.map((c) => ({ ...c }))
    await writeCenarios(seeded)
    return seeded
  }
}

async function writeCenarios(cenarios: CenarioRecord[]): Promise<void> {
  await writeFileAtomic(CENARIOS_FILE, JSON.stringify(cenarios, null, 2))
}

// ── Public actions ──────────────────────────────────────────────────────────

export async function getCenarios(): Promise<CenarioRecord[]> {
  return readCenarios()
}

export async function getCenario(id: string): Promise<CenarioRecord | null> {
  const result = idSchema.safeParse(id)
  if (!result.success) return null
  const cenarios = await readCenarios()
  return cenarios.find((c) => c.id === id) ?? null
}

export async function criarCenario(data: {
  scenarioName: string
  system: string
  module: string
  client: string
  risco: string
  regraDeNegocio: string
  descricao: string
  caminhoTela: string
  preCondicoes: string
  bdd: string
  resultadoEsperado: string
  tipo: string
  urlScript: string
  usuarioTeste: string
  senhaTeste: string
  senhaFalsa: string
  steps: CenarioStep[]
  deps: string[]
}): Promise<CenarioRecord> {
  const session = await requireSession()
  const createdBy = session?.user?.name ?? session?.user?.email ?? undefined

  const parsed = cenarioCreateSchema.parse({
    ...data,
    scenarioName:      data.scenarioName.trim(),
    client:            data.client.trim(),
    risco:             data.risco.trim(),
    regraDeNegocio:    data.regraDeNegocio.trim(),
    descricao:         data.descricao.trim(),
    caminhoTela:       data.caminhoTela.trim(),
    preCondicoes:      data.preCondicoes.trim(),
    bdd:               data.bdd.trim(),
    resultadoEsperado: data.resultadoEsperado.trim(),
    urlScript:         data.urlScript.trim(),
    usuarioTeste:      data.usuarioTeste.trim(),
    senhaTeste:        data.senhaTeste.trim(),
    senhaFalsa:        data.senhaFalsa.trim(),
  })

  const cenarios = await readCenarios()
  const id = nextId(cenarios.map((c) => c.id), "CT", 3)

  const novo: CenarioRecord = {
    id,
    scenarioName:      parsed.scenarioName,
    system:            parsed.system,
    module:            parsed.module,
    client:            parsed.client,
    execucoes:         0,
    erros:             0,
    suites:            0,
    tipo:              parsed.tipo,
    active:            true,
    createdAt:         Date.now(),
    risco:             parsed.risco,
    regraDeNegocio:    parsed.regraDeNegocio,
    descricao:         parsed.descricao,
    caminhoTela:       parsed.caminhoTela,
    preCondicoes:      parsed.preCondicoes,
    bdd:               parsed.bdd,
    resultadoEsperado: parsed.resultadoEsperado,
    urlScript:         parsed.urlScript,
    usuarioTeste:      parsed.usuarioTeste,
    senhaTeste:        parsed.senhaTeste,
    senhaFalsa:        parsed.senhaFalsa,
    steps:             parsed.steps,
    deps:              parsed.deps,
    createdBy,
  }

  cenarios.push(novo)
  await writeCenarios(cenarios)
  revalidatePath("/cenarios")
  return novo
}

export async function atualizarCenario(id: string, data: {
  scenarioName: string
  system: string
  module: string
  client: string
  risco: string
  regraDeNegocio: string
  descricao: string
  caminhoTela: string
  preCondicoes: string
  bdd: string
  resultadoEsperado: string
  tipo: string
  urlScript: string
  usuarioTeste: string
  senhaTeste: string
  senhaFalsa: string
  steps: CenarioStep[]
  deps: string[]
}): Promise<CenarioRecord> {
  await requireSession()
  const parsedId = idSchema.safeParse(id)
  if (!parsedId.success) throw new Error("ID inválido")

  const parsed = cenarioCreateSchema.parse({
    ...data,
    scenarioName:      data.scenarioName.trim(),
    client:            data.client.trim(),
    risco:             data.risco.trim(),
    regraDeNegocio:    data.regraDeNegocio.trim(),
    descricao:         data.descricao.trim(),
    caminhoTela:       data.caminhoTela.trim(),
    preCondicoes:      data.preCondicoes.trim(),
    bdd:               data.bdd.trim(),
    resultadoEsperado: data.resultadoEsperado.trim(),
    urlScript:         data.urlScript.trim(),
    usuarioTeste:      data.usuarioTeste.trim(),
    senhaTeste:        data.senhaTeste.trim(),
    senhaFalsa:        data.senhaFalsa.trim(),
  })

  const session = await auth()
  const updatedBy = session?.user?.name ?? session?.user?.email ?? undefined

  const cenarios = await readCenarios()
  const idx = cenarios.findIndex((c) => c.id === id)
  if (idx === -1) throw new Error("Cenário não encontrado")

  const existing = cenarios[idx]
  cenarios[idx] = {
    ...existing,
    scenarioName:      parsed.scenarioName,
    system:            parsed.system,
    module:            parsed.module,
    client:            parsed.client,
    tipo:              parsed.tipo,
    risco:             parsed.risco,
    regraDeNegocio:    parsed.regraDeNegocio,
    descricao:         parsed.descricao,
    caminhoTela:       parsed.caminhoTela,
    preCondicoes:      parsed.preCondicoes,
    bdd:               parsed.bdd,
    resultadoEsperado: parsed.resultadoEsperado,
    urlScript:         parsed.urlScript,
    usuarioTeste:      parsed.usuarioTeste,
    senhaTeste:        parsed.senhaTeste,
    senhaFalsa:        parsed.senhaFalsa,
    steps:             parsed.steps,
    deps:              parsed.deps,
    createdBy:         existing.createdBy ?? updatedBy,
  }

  await writeCenarios(cenarios)
  revalidatePath("/cenarios")
  revalidatePath(`/cenarios/${id}`)
  revalidatePath(`/cenarios/${id}/editar`)
  return cenarios[idx]
}

export async function inativarCenarios(ids: string[]): Promise<void> {
  await requireSession()
  if (ids.length === 0) return
  idsArraySchema.parse(ids)

  const cenarios = await readCenarios()
  const idSet = new Set(ids)
  for (const cenario of cenarios) {
    if (idSet.has(cenario.id)) cenario.active = false
  }
  await writeCenarios(cenarios)
  revalidatePath("/cenarios")
}
