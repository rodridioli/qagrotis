import { auth } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { nextId } from "@/lib/db-utils"
import { revalidatePath } from "next/cache"

export const dynamic = "force-dynamic"

// ── Schemas ───────────────────────────────────────────────────────────────────

const criarSuitePayloadSchema = z.object({
  actionName: z.literal("criar_suite"),
  suiteName: z.string().min(1).max(200),
  modulo: z.string().min(1).max(200),
  sistema: z.string().min(1).max(200),
})

const criarCenarioPayloadSchema = z.object({
  actionName: z.literal("criar_cenario"),
})

const desativarCenariosPayloadSchema = z.object({
  actionName: z.literal("desativar_cenarios"),
  cliente: z.string().min(1).max(200),
})

const buscarCenariosPayloadSchema = z.object({
  actionName: z.literal("buscar_cenarios"),
  modulo: z.string().max(200).optional(),
  sistema: z.string().max(200).optional(),
  comErro: z.boolean().optional(),
  cliente: z.string().max(200).optional(),
})

const buscarSuitesPayloadSchema = z.object({
  actionName: z.literal("buscar_suites"),
  ativas: z.boolean().optional(),
  modulo: z.string().max(200).optional(),
})

const encerrarSuitePayloadSchema = z.object({
  actionName: z.literal("encerrar_suite"),
  suiteId: z.string().min(1).max(50),
})

const reabrirSuitePayloadSchema = z.object({
  actionName: z.literal("reabrir_suite"),
  suiteId: z.string().min(1).max(50),
})

const registrarResultadoPayloadSchema = z.object({
  actionName: z.literal("registrar_resultado"),
  cenarioId: z.string().min(1).max(50),
  suiteId: z.string().max(50).optional(),
  resultado: z.enum(["Sucesso", "Erro", "Alerta"]),
  observacao: z.string().max(500).optional(),
})

const executeRequestSchema = z.object({
  actionName: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
})

// ── Handlers ──────────────────────────────────────────────────────────────────

async function handleCriarSuite(payload: unknown): Promise<{ success: true; message: string; redirectPath?: string }> {
  const data = criarSuitePayloadSchema.parse(payload)

  const existing = await prisma.suite.findMany({ select: { id: true } })
  const id = nextId(existing.map((s) => s.id), "S", 4)

  const [sysRow, modRow] = await Promise.all([
    prisma.sistema.findFirst({ where: { name: data.sistema, active: true }, select: { id: true } }),
    prisma.modulo.findFirst({ where: { name: data.modulo, sistemaName: data.sistema, active: true }, select: { id: true } }),
  ])

  await prisma.suite.create({
    data: {
      id,
      suiteName: data.suiteName,
      versao: "1.0",
      sistema: data.sistema,
      modulo: data.modulo,
      sistemaId: sysRow?.id,
      moduloId: modRow?.id,
      tipo: "Sprint",
      cliente: "",
      objetivo: null,
      active: true,
      cenarios: [],
      historico: [],
    },
  })

  revalidatePath("/suites")

  return {
    success: true,
    message: `Suite "${data.suiteName}" criada com sucesso.`,
    redirectPath: "/suites",
  }
}

async function handleCriarCenario(_payload: unknown): Promise<{ success: true; message: string; redirectPath: string }> {
  criarCenarioPayloadSchema.parse(_payload)
  return {
    success: true,
    message: "Redirecionando para o Gerador de Cenários.",
    redirectPath: "/gerador",
  }
}

async function handleDesativarCenarios(payload: unknown): Promise<{ success: true; message: string }> {
  const data = desativarCenariosPayloadSchema.parse(payload)

  const result = await prisma.cenario.updateMany({
    where: { client: { contains: data.cliente, mode: "insensitive" }, active: true },
    data: { active: false },
  })

  revalidatePath("/cenarios")

  return {
    success: true,
    message: `${result.count} cenário(s) do cliente "${data.cliente}" desativado(s).`,
  }
}

type SearchResults = { title: string; items: { id: string; name: string; module: string; meta?: string }[]; viewAllPath: string }

async function handleBuscarCenarios(payload: unknown): Promise<{ success: true; results: SearchResults }> {
  const data = buscarCenariosPayloadSchema.parse(payload)

  const where: Record<string, unknown> = { active: true }
  if (data.sistema) where.system = { contains: data.sistema, mode: "insensitive" }
  if (data.modulo) where.module = { contains: data.modulo, mode: "insensitive" }
  if (data.cliente) where.client = { contains: data.cliente, mode: "insensitive" }
  if (data.comErro) where.erros = { gt: 0 }

  const cenarios = await prisma.cenario.findMany({
    where,
    select: { id: true, scenarioName: true, module: true, erros: true },
    orderBy: data.comErro ? { erros: "desc" } : { createdAt: "desc" },
    take: 10,
  })

  const items = cenarios.map((c) => ({
    id: c.id,
    name: c.scenarioName,
    module: c.module,
    meta: c.erros > 0 ? `${c.erros} ${c.erros === 1 ? "erro" : "erros"}` : undefined,
  }))

  const params = new URLSearchParams()
  if (data.modulo) params.set("modulo", data.modulo)
  if (data.comErro) params.set("comErro", "1")
  if (data.cliente) params.set("cliente", data.cliente)

  const viewAllPath = `/cenarios${params.toString() ? `?${params.toString()}` : ""}`
  const count = cenarios.length
  const title = count === 0
    ? "Nenhum cenário encontrado"
    : `${count} cenário${count !== 1 ? "s" : ""} encontrado${count !== 1 ? "s" : ""}`

  return { success: true, results: { title, items, viewAllPath } }
}

async function handleBuscarSuites(payload: unknown): Promise<{ success: true; results: SearchResults }> {
  const data = buscarSuitesPayloadSchema.parse(payload)

  const where: Record<string, unknown> = { active: true }
  if (data.ativas !== undefined) where.encerrada = !data.ativas
  if (data.modulo) where.modulo = { contains: data.modulo, mode: "insensitive" }

  const suites = await prisma.suite.findMany({
    where,
    select: { id: true, suiteName: true, modulo: true, encerrada: true },
    orderBy: { suiteName: "asc" },
    take: 10,
  })

  const items = suites.map((s) => ({
    id: s.id,
    name: s.suiteName,
    module: s.modulo,
    meta: s.encerrada ? "Encerrada" : "Ativa",
  }))

  const viewAllPath = data.ativas === false ? "/suites?encerradas=1" : "/suites"
  const count = suites.length
  const title = count === 0
    ? "Nenhuma suite encontrada"
    : `${count} suite${count !== 1 ? "s" : ""} encontrada${count !== 1 ? "s" : ""}`

  return { success: true, results: { title, items, viewAllPath } }
}

async function handleEncerrarSuite(payload: unknown): Promise<{ success: true; message: string } | { success: false; error: string }> {
  const data = encerrarSuitePayloadSchema.parse(payload)

  const suite = await prisma.suite.findUnique({
    where: { id: data.suiteId },
    select: { id: true, suiteName: true, encerrada: true },
  })
  if (!suite) return { success: false, error: `Suite "${data.suiteId}" não encontrada.` }
  if (suite.encerrada) return { success: false, error: `A suite "${suite.suiteName}" já está encerrada.` }

  await prisma.suite.update({ where: { id: data.suiteId }, data: { encerrada: true } })
  revalidatePath("/suites")

  return { success: true, message: `Suite "${suite.suiteName}" encerrada com sucesso.` }
}

async function handleReabrirSuite(payload: unknown): Promise<{ success: true; message: string } | { success: false; error: string }> {
  const data = reabrirSuitePayloadSchema.parse(payload)

  const suite = await prisma.suite.findUnique({
    where: { id: data.suiteId },
    select: { id: true, suiteName: true, encerrada: true },
  })
  if (!suite) return { success: false, error: `Suite "${data.suiteId}" não encontrada.` }
  if (!suite.encerrada) return { success: false, error: `A suite "${suite.suiteName}" já está ativa.` }

  await prisma.suite.update({ where: { id: data.suiteId }, data: { encerrada: false } })
  revalidatePath("/suites")

  return { success: true, message: `Suite "${suite.suiteName}" reaberta com sucesso.` }
}

async function handleRegistrarResultado(
  payload: unknown,
  userName: string,
): Promise<{ success: true; message: string } | { success: false; error: string }> {
  const data = registrarResultadoPayloadSchema.parse(payload)

  const cenario = await prisma.cenario.findUnique({
    where: { id: data.cenarioId },
    select: { id: true, scenarioName: true },
  })
  if (!cenario) return { success: false, error: `Cenário "${data.cenarioId}" não encontrado.` }

  let suiteId = data.suiteId ?? ""

  if (!suiteId) {
    // Auto-find the active suite containing this cenário
    const activeSuites = await prisma.suite.findMany({
      where: { active: true, encerrada: false },
      select: { id: true, suiteName: true, cenarios: true },
    })
    const matching = activeSuites.filter((s) => {
      const ids = s.cenarios as string[]
      return ids.includes(data.cenarioId)
    })
    if (matching.length === 0) {
      return { success: false, error: `"${cenario.scenarioName}" não está em nenhuma suite ativa.` }
    }
    if (matching.length > 1) {
      const names = matching.map((s) => s.suiteName).join(", ")
      return { success: false, error: `"${cenario.scenarioName}" está em ${matching.length} suites ativas. Especifique: ${names}.` }
    }
    suiteId = matching[0].id
  }

  const suite = await prisma.suite.findUnique({
    where: { id: suiteId },
    select: { id: true, suiteName: true, encerrada: true, historico: true },
  })
  if (!suite) return { success: false, error: `Suite "${suiteId}" não encontrada.` }
  if (suite.encerrada) return { success: false, error: `A suite "${suite.suiteName}" está encerrada.` }

  const historico = (suite.historico as Array<Record<string, unknown>>)
  const novoRegistro: Record<string, unknown> = {
    id: `${Date.now()}`,
    cenario: data.cenarioId,
    resultado: data.resultado,
    timestamp: new Date().toISOString(),
    executadoPor: userName,
  }
  if (data.observacao) novoRegistro.observacao = data.observacao

  await prisma.suite.update({
    where: { id: suiteId },
    data: { historico: [...historico, novoRegistro] },
  })

  revalidatePath(`/suites/${suiteId}`)
  revalidatePath("/suites")

  return {
    success: true,
    message: `"${data.resultado}" registrado para "${cenario.scenarioName}" na suite "${suite.suiteName}".`,
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: "Corpo inválido" }, { status: 400 })
  }

  const parsed = executeRequestSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Dados inválidos" }, { status: 400 })
  }

  const { actionName, payload } = parsed.data
  const userName = session.user.name ?? session.user.email ?? "Usuário"

  try {
    switch (actionName) {
      case "criar_suite":
        return NextResponse.json(await handleCriarSuite(payload))
      case "criar_cenario":
        return NextResponse.json(await handleCriarCenario(payload))
      case "desativar_cenarios":
        return NextResponse.json(await handleDesativarCenarios(payload))
      case "buscar_cenarios":
        return NextResponse.json(await handleBuscarCenarios(payload))
      case "buscar_suites":
        return NextResponse.json(await handleBuscarSuites(payload))
      case "encerrar_suite":
        return NextResponse.json(await handleEncerrarSuite(payload))
      case "reabrir_suite":
        return NextResponse.json(await handleReabrirSuite(payload))
      case "registrar_resultado":
        return NextResponse.json(await handleRegistrarResultado(payload, userName))
      default:
        return NextResponse.json({ success: false, error: `Ação desconhecida: ${actionName}` }, { status: 400 })
    }
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: "Payload inválido", details: err.flatten() }, { status: 400 })
    }
    console.error("[command-bar/execute] error:", err)
    return NextResponse.json({ success: false, error: "Erro interno ao executar a ação." }, { status: 500 })
  }
}
