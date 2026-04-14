"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { nextId } from "@/lib/db-utils"
import { requireAdmin, requireSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export interface ClienteRecord {
  id: string
  nomeFantasia: string
  razaoSocial: string | null
  cpfCnpj: string | null
  active: boolean
  createdAt?: number
}

// ── Validation schemas ──────────────────────────────────────────────────────

// CPF: 000.000.000-00 or 00000000000 | CNPJ: 00.000.000/0000-00 or 00000000000000
const cpfCnpjSchema = z
  .string()
  .max(18)
  .nullable()
  .refine(
    (v) => !v || /^(\d{3}\.?\d{3}\.?\d{3}-?\d{2}|\d{2}\.?\d{3}\.?\d{3}\/??\d{4}-?\d{2})$/.test(v.trim()),
    { message: "CPF ou CNPJ inválido" }
  )

const clienteInputSchema = z.object({
  nomeFantasia: z.string().min(1, "Nome Fantasia é obrigatório").max(200),
  razaoSocial: z.string().max(200).nullable(),
  cpfCnpj: cpfCnpjSchema,
})

const idSchema = z.string().regex(/^CLI-\d+$/, "ID inválido")
const idsArraySchema = z.array(idSchema).max(1000)

// ── Mapping helper ──────────────────────────────────────────────────────────

function toRecord(row: { id: string; nomeFantasia: string; razaoSocial: string | null; cpfCnpj: string | null; active: boolean; createdAt: Date }): ClienteRecord {
  return { ...row, createdAt: row.createdAt.getTime() }
}

// ── Public actions ──────────────────────────────────────────────────────────

export async function getClientes(): Promise<ClienteRecord[]> {
  const rows = await prisma.cliente.findMany({ orderBy: { createdAt: "asc" } })
  return rows.map(toRecord)
}

export async function getCliente(id: string): Promise<ClienteRecord | null> {
  const result = idSchema.safeParse(id)
  if (!result.success) return null
  const row = await prisma.cliente.findUnique({ where: { id } })
  return row ? toRecord(row) : null
}

export async function criarCliente(data: {
  nomeFantasia: string
  razaoSocial: string | null
  cpfCnpj: string | null
}): Promise<ClienteRecord> {
  await requireSession()
  const parsed = clienteInputSchema.parse({
    nomeFantasia: data.nomeFantasia.trim(),
    razaoSocial: data.razaoSocial?.trim() || null,
    cpfCnpj: data.cpfCnpj?.trim() || null,
  })

  const existing = await prisma.cliente.findMany({ select: { id: true, nomeFantasia: true, active: true } })

  const duplicate = existing.some(
    (c) => c.active && c.nomeFantasia.trim().toLowerCase() === parsed.nomeFantasia.trim().toLowerCase()
  )
  if (duplicate) throw new Error("Já existe um cliente ativo com esse nome.")

  const id = nextId(existing.map((c) => c.id), "CLI")

  const row = await prisma.cliente.create({ data: { id, ...parsed, active: true } })
  revalidatePath("/configuracoes/clientes")
  revalidatePath("/cenarios")
  revalidatePath("/cenarios/novo")
  revalidatePath("/suites")
  revalidatePath("/gerador")
  return toRecord(row)
}

export async function atualizarCliente(
  id: string,
  data: { nomeFantasia: string; razaoSocial: string | null; cpfCnpj: string | null }
): Promise<void> {
  await requireAdmin()
  idSchema.parse(id)
  const parsed = clienteInputSchema.parse({
    nomeFantasia: data.nomeFantasia.trim(),
    razaoSocial: data.razaoSocial?.trim() || null,
    cpfCnpj: data.cpfCnpj?.trim() || null,
  })

  const existing = await prisma.cliente.findUnique({ where: { id }, select: { nomeFantasia: true } })
  const oldName = existing?.nomeFantasia

  // Propagate rename to cenarios and suites atomically
  await prisma.$transaction([
    prisma.cliente.update({ where: { id }, data: parsed }),
    ...(oldName && oldName !== parsed.nomeFantasia
      ? [
          prisma.cenario.updateMany({ where: { client: oldName }, data: { client: parsed.nomeFantasia } }),
          prisma.suite.updateMany({ where: { cliente: oldName }, data: { cliente: parsed.nomeFantasia } }),
        ]
      : []),
  ])

  revalidatePath("/configuracoes/clientes")
  revalidatePath(`/configuracoes/clientes/${id}/editar`)
  revalidatePath("/cenarios")
  revalidatePath("/cenarios/novo")
  revalidatePath("/suites")
  revalidatePath("/gerador")
}

export async function inativarClientes(ids: string[]): Promise<void> {
  await requireAdmin()
  if (ids.length === 0) return
  idsArraySchema.parse(ids)

  // Busca clientes para propagar a limpeza dos vínculos
  const clients = await prisma.cliente.findMany({
    where: { id: { in: ids } },
    select: { nomeFantasia: true },
  })
  const clientNames = clients.map((c) => c.nomeFantasia)

  await prisma.$transaction([
    prisma.cliente.updateMany({ where: { id: { in: ids } }, data: { active: false } }),
    // Limpa o campo cliente dos cenários e suites vinculados
    ...(clientNames.length > 0
      ? [
          prisma.cenario.updateMany({ where: { client: { in: clientNames } }, data: { client: "" } }),
          prisma.suite.updateMany({ where: { cliente: { in: clientNames } }, data: { cliente: "" } }),
        ]
      : []),
  ])

  revalidatePath("/configuracoes/clientes")
  revalidatePath("/cenarios")
  revalidatePath("/cenarios/novo")
  revalidatePath("/suites")
  revalidatePath("/gerador")
}
