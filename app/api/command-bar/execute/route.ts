import { auth } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { nextId } from "@/lib/db-utils"
import { revalidatePath } from "next/cache"

export const dynamic = "force-dynamic"

// ── Schemas per action ────────────────────────────────────────────────────────

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

const executeRequestSchema = z.object({
  actionName: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
})

// ── Action handlers ───────────────────────────────────────────────────────────

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
    where: { client: { contains: data.cliente }, active: true },
    data: { active: false },
  })

  revalidatePath("/cenarios")

  return {
    success: true,
    message: `${result.count} cenário(s) do cliente "${data.cliente}" desativado(s).`,
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

  try {
    switch (actionName) {
      case "criar_suite":
        return NextResponse.json(await handleCriarSuite(payload))

      case "criar_cenario":
        return NextResponse.json(await handleCriarCenario(payload))

      case "desativar_cenarios":
        return NextResponse.json(await handleDesativarCenarios(payload))

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
