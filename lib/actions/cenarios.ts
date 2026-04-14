"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requireSession } from "@/lib/session"
import { nextId } from "@/lib/db-utils"
import { prisma } from "@/lib/prisma"

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
  urlAmbiente?: string
  objetivo?: string
  urlScript?: string
  usuarioTeste?: string
  senhaTeste?: string
  senhaFalsa?: string
  steps?: CenarioStep[]
  deps?: string[]
  createdBy?: string
}

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
  regraDeNegocio:    z.string().max(5000),
  descricao:         z.string().max(5000),
  caminhoTela:       z.string().max(1000),
  preCondicoes:      z.string().max(5000),
  bdd:               z.string().max(5000),
  resultadoEsperado: z.string().min(1, "Resultado Esperado é obrigatório").max(5000),
  tipo:              z.enum(["Manual", "Automatizado", "Man./Auto."]),
  urlAmbiente:       z.string().max(1000),
  objetivo:          z.string().max(5000),
  urlScript:         z.string().max(1000),
  usuarioTeste:      z.string().max(200),
  senhaTeste:        z.string().max(200),
  senhaFalsa:        z.string().max(200),
  steps:             z.array(z.object({ acao: z.string().min(1).max(1000), resultado: z.string().min(1).max(1000) })).max(100),
  deps:              z.array(idSchema).max(100),
})

// ── Mapping helper ──────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toRecord(row: any): CenarioRecord {
  return {
    id:                row.id,
    scenarioName:      row.scenarioName,
    system:            row.system,
    module:            row.module,
    client:            row.client,
    execucoes:         row.execucoes,
    erros:             row.erros,
    suites:            row.suites,
    tipo:              row.tipo,
    active:            row.active,
    createdAt:         row.createdAt instanceof Date ? row.createdAt.getTime() : (row.createdAt ?? undefined),
    risco:             row.risco ?? undefined,
    regraDeNegocio:    row.regraDeNegocio ?? undefined,
    descricao:         row.descricao ?? undefined,
    caminhoTela:       row.caminhoTela ?? undefined,
    preCondicoes:      row.preCondicoes ?? undefined,
    bdd:               row.bdd ?? undefined,
    resultadoEsperado: row.resultadoEsperado ?? undefined,
    urlAmbiente:       row.urlAmbiente ?? undefined,
    objetivo:          row.objetivo ?? undefined,
    urlScript:         row.urlScript ?? undefined,
    usuarioTeste:      row.usuarioTeste ?? undefined,
    senhaTeste:        row.senhaTeste ?? undefined,
    senhaFalsa:        row.senhaFalsa ?? undefined,
    steps:             (row.steps as unknown as CenarioStep[]) ?? [],
    deps:              (row.deps as string[]) ?? [],
    createdBy:         row.createdBy ?? undefined,
  }
}

// ── Public actions ──────────────────────────────────────────────────────────

export async function getCenarios(): Promise<CenarioRecord[]> {
  const rows = await prisma.cenario.findMany({ orderBy: { createdAt: "asc" } })
  return rows.map(toRecord)
}

export async function getCenario(id: string): Promise<CenarioRecord | null> {
  const result = idSchema.safeParse(id)
  if (!result.success) return null
  const row = await prisma.cenario.findUnique({ where: { id } })
  return row ? toRecord(row) : null
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
  urlAmbiente: string
  objetivo: string
  urlScript: string
  usuarioTeste: string
  senhaTeste: string
  senhaFalsa: string
  steps: CenarioStep[]
  deps: string[]
}): Promise<CenarioRecord> {
  const session = await requireSession()
  const createdBy = session?.user?.name ?? session?.user?.email ?? undefined

  let parsed: z.infer<typeof cenarioCreateSchema>
  try {
    parsed = cenarioCreateSchema.parse({
      ...data,
      scenarioName:      (data.scenarioName || "").trim(),
      client:            (data.client || "").trim(),
      risco:             (data.risco || "").trim(),
      regraDeNegocio:    (data.regraDeNegocio || "").trim(),
      descricao:         (data.descricao || "").trim(),
      caminhoTela:       (data.caminhoTela || "").trim(),
      preCondicoes:      (data.preCondicoes || "").trim(),
      bdd:               (data.bdd || "").trim(),
      resultadoEsperado: (data.resultadoEsperado || "").trim(),
      urlAmbiente:       (data.urlAmbiente || "").trim(),
      objetivo:          (data.objetivo || "").trim(),
      urlScript:         (data.urlScript || "").trim(),
      usuarioTeste:      (data.usuarioTeste || "").trim(),
      senhaTeste:        (data.senhaTeste || "").trim(),
      senhaFalsa:        (data.senhaFalsa || "").trim(),
    })
  } catch (e) {
    if (e instanceof z.ZodError) throw new Error(e.issues[0]?.message ?? "Dados inválidos.")
    throw e
  }

  const existing = await prisma.cenario.findMany({ select: { id: true } })
  const id = nextId(existing.map((c: { id: string }) => c.id), "CT", 3)

  // Lookup IDs by name for data integrity
  const [sysRow, modRow] = await Promise.all([
    prisma.sistema.findFirst({ where: { name: parsed.system, active: true }, select: { id: true } }),
    prisma.modulo.findFirst({ where: { name: parsed.module, sistemaName: parsed.system, active: true }, select: { id: true } })
  ])

  const row = await prisma.cenario.create({
    data: {
      id,
      scenarioName:      parsed.scenarioName,
      system:            parsed.system,
      module:            parsed.module,
      systemId:          sysRow?.id,
      moduleId:          modRow?.id,
      client:            parsed.client,
      execucoes:         0,
      erros:             0,
      suites:            0,
      tipo:              parsed.tipo,
      active:            true,
      risco:             parsed.risco,
      regraDeNegocio:    parsed.regraDeNegocio,
      descricao:         parsed.descricao,
      caminhoTela:       parsed.caminhoTela,
      preCondicoes:      parsed.preCondicoes,
      bdd:               parsed.bdd,
      resultadoEsperado: parsed.resultadoEsperado,
      urlAmbiente:       parsed.urlAmbiente,
      objetivo:          parsed.objetivo,
      urlScript:         parsed.urlScript,
      usuarioTeste:      parsed.usuarioTeste,
      senhaTeste:        parsed.senhaTeste,
      senhaFalsa:        parsed.senhaFalsa,
      steps:             parsed.steps,
      deps:              parsed.deps,
      createdBy,
    },
  })

  revalidatePath("/cenarios")
  revalidatePath("/suites/nova")
  revalidatePath("/suites")
  return toRecord(row)
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
  urlAmbiente: string
  objetivo: string
  urlScript: string
  usuarioTeste: string
  senhaTeste: string
  senhaFalsa: string
  steps: CenarioStep[]
  deps: string[]
}): Promise<CenarioRecord> {
  const session = await requireSession()
  const parsedId = idSchema.safeParse(id)
  if (!parsedId.success) throw new Error("ID inválido")

  let parsed: z.infer<typeof cenarioCreateSchema>
  try {
    parsed = cenarioCreateSchema.parse({
      ...data,
      scenarioName:      (data.scenarioName || "").trim(),
      client:            (data.client || "").trim(),
      risco:             (data.risco || "").trim(),
      regraDeNegocio:    (data.regraDeNegocio || "").trim(),
      descricao:         (data.descricao || "").trim(),
      caminhoTela:       (data.caminhoTela || "").trim(),
      preCondicoes:      (data.preCondicoes || "").trim(),
      bdd:               (data.bdd || "").trim(),
      resultadoEsperado: (data.resultadoEsperado || "").trim(),
      urlAmbiente:       (data.urlAmbiente || "").trim(),
      objetivo:          (data.objetivo || "").trim(),
      urlScript:         (data.urlScript || "").trim(),
      usuarioTeste:      (data.usuarioTeste || "").trim(),
      senhaTeste:        (data.senhaTeste || "").trim(),
      senhaFalsa:        (data.senhaFalsa || "").trim(),
    })
  } catch (e) {
    if (e instanceof z.ZodError) throw new Error(e.issues[0]?.message ?? "Dados inválidos.")
    throw e
  }

  const updatedBy = session.user?.name ?? session.user?.email ?? undefined

  const existing = await prisma.cenario.findUnique({ where: { id }, select: { createdBy: true } })
  if (!existing) throw new Error("Cenário não encontrado")

  // Lookup IDs by name for data integrity update
  const [sysRow, modRow] = await Promise.all([
    prisma.sistema.findFirst({ where: { name: parsed.system, active: true }, select: { id: true } }),
    prisma.modulo.findFirst({ where: { name: parsed.module, sistemaName: parsed.system, active: true }, select: { id: true } })
  ])

  const row = await prisma.cenario.update({
    where: { id },
    data: {
      scenarioName:      parsed.scenarioName,
      system:            parsed.system,
      module:            parsed.module,
      systemId:          sysRow?.id,
      moduleId:          modRow?.id,
      client:            parsed.client,
      tipo:              parsed.tipo,
      risco:             parsed.risco,
      regraDeNegocio:    parsed.regraDeNegocio,
      descricao:         parsed.descricao,
      caminhoTela:       parsed.caminhoTela,
      preCondicoes:      parsed.preCondicoes,
      bdd:               parsed.bdd,
      resultadoEsperado: parsed.resultadoEsperado,
      urlAmbiente:       parsed.urlAmbiente,
      objetivo:          parsed.objetivo,
      urlScript:         parsed.urlScript,
      usuarioTeste:      parsed.usuarioTeste,
      senhaTeste:        parsed.senhaTeste,
      senhaFalsa:        parsed.senhaFalsa,
      steps:             parsed.steps,
      deps:              parsed.deps,
      createdBy:         existing.createdBy ?? updatedBy,
    },
  })

  revalidatePath("/cenarios")
  revalidatePath(`/cenarios/${id}`)
  revalidatePath(`/cenarios/${id}/editar`)
  return toRecord(row)
}

export async function inativarCenarios(ids: string[]): Promise<void> {
  await requireSession()
  if (ids.length === 0) return
  idsArraySchema.parse(ids)

  await prisma.cenario.updateMany({ where: { id: { in: ids } }, data: { active: false } })
  revalidatePath("/cenarios")
}
