"use server"

import { promises as fs } from "fs"
import path from "path"
import { revalidatePath } from "next/cache"
import { z } from "zod"

export interface ClienteRecord {
  id: string
  nomeFantasia: string
  razaoSocial: string | null
  cpfCnpj: string | null
  active: boolean
  createdAt?: number
}

const DATA_DIR = path.join(process.cwd(), "data")
const CLIENTES_FILE = path.join(DATA_DIR, "clientes.json")

// ── Validation schemas ──────────────────────────────────────────────────────

const clienteInputSchema = z.object({
  nomeFantasia: z.string().min(1, "Nome Fantasia é obrigatório").max(200),
  razaoSocial: z.string().max(200).nullable(),
  cpfCnpj: z.string().max(20).nullable(),
})

const idSchema = z.string().regex(/^CLI-\d+$/, "ID inválido")
const idsArraySchema = z.array(idSchema).max(1000)

// ── Storage helpers ─────────────────────────────────────────────────────────

async function readClientes(): Promise<ClienteRecord[]> {
  try {
    const content = await fs.readFile(CLIENTES_FILE, "utf-8")
    return JSON.parse(content) as ClienteRecord[]
  } catch {
    return []
  }
}

async function writeClientes(clientes: ClienteRecord[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true })
  await fs.writeFile(CLIENTES_FILE, JSON.stringify(clientes, null, 2), "utf-8")
}

// ── Public actions ──────────────────────────────────────────────────────────

export async function getClientes(): Promise<ClienteRecord[]> {
  return readClientes()
}

export async function getCliente(id: string): Promise<ClienteRecord | null> {
  const result = idSchema.safeParse(id)
  if (!result.success) return null
  const clientes = await readClientes()
  return clientes.find((c) => c.id === id) ?? null
}

export async function criarCliente(data: {
  nomeFantasia: string
  razaoSocial: string | null
  cpfCnpj: string | null
}): Promise<ClienteRecord> {
  const parsed = clienteInputSchema.parse({
    nomeFantasia: data.nomeFantasia.trim(),
    razaoSocial: data.razaoSocial?.trim() || null,
    cpfCnpj: data.cpfCnpj?.trim() || null,
  })

  const clientes = await readClientes()
  const nums = clientes
    .map((c) => parseInt(c.id.replace("CLI-", ""), 10))
    .filter((n) => !isNaN(n))
  const nextNum = nums.length > 0 ? Math.max(...nums) + 1 : 1
  const id = `CLI-${String(nextNum).padStart(2, "0")}`

  const novo: ClienteRecord = { id, ...parsed, active: true, createdAt: Date.now() }
  clientes.push(novo)
  await writeClientes(clientes)
  revalidatePath("/configuracoes/clientes")
  return novo
}

export async function atualizarCliente(
  id: string,
  data: { nomeFantasia: string; razaoSocial: string | null; cpfCnpj: string | null }
): Promise<void> {
  idSchema.parse(id)
  const parsed = clienteInputSchema.parse({
    nomeFantasia: data.nomeFantasia.trim(),
    razaoSocial: data.razaoSocial?.trim() || null,
    cpfCnpj: data.cpfCnpj?.trim() || null,
  })

  const clientes = await readClientes()
  const idx = clientes.findIndex((c) => c.id === id)
  if (idx === -1) return

  clientes[idx] = { ...clientes[idx], ...parsed }
  await writeClientes(clientes)
  revalidatePath("/configuracoes/clientes")
  revalidatePath(`/configuracoes/clientes/${id}/editar`)
}

export async function inativarClientes(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  idsArraySchema.parse(ids)

  const clientes = await readClientes()
  const idSet = new Set(ids)
  for (const cliente of clientes) {
    if (idSet.has(cliente.id)) cliente.active = false
  }
  await writeClientes(clientes)
  revalidatePath("/configuracoes/clientes")
}
