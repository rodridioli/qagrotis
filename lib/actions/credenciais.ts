"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { nextId, encryptField, decryptField } from "@/lib/db-utils"
import { requireAdmin, requireSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export interface CredencialRecord {
  id: string
  nome: string
  urlAmbiente: string | null
  usuario: string
  active: boolean
  createdAt: number
}

const credencialInputSchema = z.object({
  nome:        z.string().min(1, "Credencial é obrigatório").max(200),
  urlAmbiente: z.string().max(1000).nullable().optional(),
  usuario:     z.string().min(1, "Usuário é obrigatório").max(200),
  senha:       z.string().min(1, "Senha é obrigatória").max(500),
})

const idSchema = z.string().regex(/^CRD-\d+$/, "ID inválido")

function toRecord(row: {
  id: string
  nome: string
  urlAmbiente: string | null
  usuario: string
  active: boolean
  createdAt: Date
}): CredencialRecord {
  return { ...row, createdAt: row.createdAt.getTime() }
}

export async function getCredenciais(): Promise<CredencialRecord[]> {
  await requireSession()
  const rows = await prisma.credencial.findMany({
    where: { active: true },
    orderBy: { createdAt: "desc" },
    select: { id: true, nome: true, urlAmbiente: true, usuario: true, active: true, createdAt: true },
    take: 500,
  })
  return rows.map(toRecord)
}

export async function criarCredencial(data: {
  nome: string
  urlAmbiente?: string | null
  usuario: string
  senha: string
}): Promise<CredencialRecord> {
  await requireAdmin()
  const parsed = credencialInputSchema.parse({
    nome:        data.nome.trim(),
    urlAmbiente: data.urlAmbiente?.trim() || null,
    usuario:     data.usuario.trim(),
    senha:       data.senha,
  })

  const existing = await prisma.credencial.findMany({ select: { id: true } })
  const id = nextId(existing.map((c) => c.id), "CRD")

  const row = await prisma.credencial.create({
    data: { id, nome: parsed.nome, urlAmbiente: parsed.urlAmbiente ?? null, usuario: parsed.usuario, senha: encryptField(parsed.senha), active: true },
    select: { id: true, nome: true, urlAmbiente: true, usuario: true, active: true, createdAt: true },
  })

  revalidatePath("/configuracoes/credenciais")
  revalidatePath("/cenarios")
  return toRecord(row)
}

export async function atualizarCredencial(
  id: string,
  data: { nome: string; urlAmbiente?: string | null; usuario: string; senha?: string }
): Promise<CredencialRecord> {
  await requireAdmin()
  idSchema.parse(id)
  const parsed = z.object({
    nome:        z.string().min(1).max(200),
    urlAmbiente: z.string().max(1000).nullable().optional(),
    usuario:     z.string().min(1).max(200),
    senha:       z.string().min(1).max(500).optional(),
  }).parse({
    nome:        data.nome.trim(),
    urlAmbiente: data.urlAmbiente?.trim() || null,
    usuario:     data.usuario.trim(),
    senha:       data.senha || undefined,
  })

  const updateData: Record<string, unknown> = {
    nome: parsed.nome,
    urlAmbiente: parsed.urlAmbiente ?? null,
    usuario: parsed.usuario,
  }
  if (parsed.senha) updateData.senha = encryptField(parsed.senha)

  const row = await prisma.credencial.update({
    where: { id },
    data: updateData,
    select: { id: true, nome: true, urlAmbiente: true, usuario: true, active: true, createdAt: true },
  })

  revalidatePath("/configuracoes/credenciais")
  revalidatePath("/cenarios")
  return toRecord(row)
}

export async function inativarCredencial(id: string): Promise<void> {
  await requireAdmin()
  idSchema.parse(id)
  await prisma.credencial.update({ where: { id }, data: { active: false } })
  revalidatePath("/configuracoes/credenciais")
}

function normalizeUrlAmbienteParaMatch(url: string): string {
  const t = url.trim().replace(/\/+$/, "")
  try {
    const u = new URL(t.startsWith("http://") || t.startsWith("https://") ? t : `https://${t}`)
    const path = u.pathname.replace(/\/+$/, "") || ""
    return `${u.protocol}//${u.host}${path}`.toLowerCase()
  } catch {
    return t.toLowerCase()
  }
}

/**
 * Importação de cenários automatizados: procura credencial ativa com os mesmos dados que em
 * `/configuracoes/credenciais` (URL do ambiente, utilizador, senha, equivalentes a Ambiente de QA / Login / Senha no .md).
 * Se não existir, cria uma nova com nome `Credencial [utilizador da sessão] + [data atual]`.
 */
export async function encontrarOuCriarCredencialPorImportacao(data: {
  urlAmbiente: string
  usuario: string
  senha: string
}): Promise<CredencialRecord> {
  const session = await requireSession()
  const urlAmbiente = data.urlAmbiente.trim()
  const usuario = data.usuario.trim()
  const senha = data.senha
  if (!urlAmbiente || !usuario || !senha) {
    throw new Error("URL do ambiente, usuário e senha são obrigatórios para a credencial.")
  }

  const normTarget = normalizeUrlAmbienteParaMatch(urlAmbiente)
  const rows = await prisma.credencial.findMany({
    where: { active: true },
    select: { id: true, nome: true, urlAmbiente: true, usuario: true, senha: true, active: true, createdAt: true },
    take: 500,
  })

  for (const row of rows) {
    const ru = (row.urlAmbiente ?? "").trim()
    if (!ru) continue
    if (normalizeUrlAmbienteParaMatch(ru) !== normTarget) continue
    if (row.usuario.trim() !== usuario) continue
    if (decryptField(row.senha) !== senha) continue
    return toRecord(row)
  }

  const userLabel = (
    session.user?.name?.trim() ||
    session.user?.email?.trim() ||
    "Utilizador"
  ).replace(/\s+/g, " ")
  const dateStr = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
  const nome = `Credencial [${userLabel}] + ${dateStr}`.slice(0, 200)
  return criarCredencial({ nome, urlAmbiente, usuario, senha })
}
