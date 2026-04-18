"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { nextId } from "@/lib/db-utils"
import { requireSession } from "@/lib/session"
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
  await requireSession()
  const parsed = credencialInputSchema.parse({
    nome:        data.nome.trim(),
    urlAmbiente: data.urlAmbiente?.trim() || null,
    usuario:     data.usuario.trim(),
    senha:       data.senha,
  })

  const existing = await prisma.credencial.findMany({ select: { id: true } })
  const id = nextId(existing.map((c) => c.id), "CRD")

  const row = await prisma.credencial.create({
    data: { id, nome: parsed.nome, urlAmbiente: parsed.urlAmbiente ?? null, usuario: parsed.usuario, senha: parsed.senha, active: true },
    select: { id: true, nome: true, urlAmbiente: true, usuario: true, active: true, createdAt: true },
  })

  revalidatePath("/configuracoes/credenciais")
  revalidatePath("/cenarios")
  return toRecord(row)
}

export async function inativarCredencial(id: string): Promise<void> {
  await requireSession()
  idSchema.parse(id)
  await prisma.credencial.update({ where: { id }, data: { active: false } })
  revalidatePath("/configuracoes/credenciais")
}
