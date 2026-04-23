"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import {
  isValidNewChapterDate,
  isValidUpdatedChapterDate,
  parseYmdToDbDate,
  ymdFromDbDate,
} from "@/lib/equipe-chapter-dates"
import { getQaUsers } from "@/lib/actions/usuarios"
import { requireAdmin, requireSession } from "@/lib/session"

/** Shape retornado por `findMany` com `authors` (evita implicit any sem client gerado). */
interface EquipeChapterAuthorLink {
  userId: string
}

interface EquipeChapterWithAuthors {
  id: string
  data: Date
  createdAt: Date
  tema: string
  hyperlink: string | null
  authors: EquipeChapterAuthorLink[]
}

type EquipeChapterDbTx = Pick<typeof prisma, "equipeChapter" | "equipeChapterAuthor">

const idSchema = z.string().min(1).max(128)

const createSchema = z.object({
  tema: z.string().trim().min(1, "O tema é obrigatório.").max(240, "O tema pode ter no máximo 240 caracteres."),
  dataYmd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
  authorIds: z.array(z.string().min(1).max(128)).min(1, "Selecione pelo menos um autor."),
  hyperlink: z.string().max(2048).optional(),
})

function normalizeHyperlink(
  raw: string | null | undefined,
): { ok: true; value: string | null } | { ok: false; error: string } {
  const t = (raw ?? "").trim()
  if (!t) return { ok: true, value: null }
  try {
    const u = new URL(t)
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      return { ok: false, error: "O link deve usar http:// ou https://." }
    }
    return { ok: true, value: t }
  } catch {
    return { ok: false, error: "URL inválida." }
  }
}

const updateSchema = createSchema.extend({
  id: idSchema,
})

export interface EquipeChapterAuthorOption {
  id: string
  name: string
}

export interface EquipeChapterListRow {
  id: string
  edicao: number
  dataYmd: string
  tema: string
  autoresLabel: string
  hyperlink: string | null
  authorIds: string[]
}

async function activeAuthorIdSet(): Promise<Set<string>> {
  const users = await getQaUsers()
  return new Set(users.filter((u) => u.active).map((u) => u.id))
}

function nameByUserIdMap(): Promise<Map<string, string>> {
  return getQaUsers().then((users) => {
    const m = new Map<string, string>()
    for (const u of users) {
      if (u.active) m.set(u.id, u.name.trim() || u.email || u.id)
    }
    return m
  })
}

/** Autores ativos para multi-select (mesma base que /configuracoes/usuarios). */
export async function listEquipeChapterAuthorOptions(): Promise<EquipeChapterAuthorOption[]> {
  await requireSession()
  const users = await getQaUsers()
  return users
    .filter((u) => u.active)
    .map((u) => ({ id: u.id, name: (u.name || u.email || u.id).trim() || u.id }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
}

export async function listEquipeChapters(): Promise<EquipeChapterListRow[]> {
  await requireSession()

  const chapters = (await prisma.equipeChapter.findMany({
    include: { authors: true },
    orderBy: [{ data: "asc" }, { createdAt: "asc" }],
  })) as EquipeChapterWithAuthors[]

  const names = await nameByUserIdMap()
  const editionById = new Map<string, number>()
  chapters.forEach((c: EquipeChapterWithAuthors, i: number) => editionById.set(c.id, i + 1))

  const rowsDesc = [...chapters].sort((a: EquipeChapterWithAuthors, b: EquipeChapterWithAuthors) => {
    const ta = a.data.getTime()
    const tb = b.data.getTime()
    if (tb !== ta) return tb - ta
    return b.createdAt.getTime() - a.createdAt.getTime()
  })

  return rowsDesc.map((c: EquipeChapterWithAuthors) => {
    const authorIds = c.authors.map((a: EquipeChapterAuthorLink) => a.userId)
    const autoresLabel = authorIds
      .map((id: string) => names.get(id) ?? id)
      .sort((a: string, b: string) => a.localeCompare(b, "pt-BR"))
      .join(", ")
    return {
      id: c.id,
      edicao: editionById.get(c.id) ?? 0,
      dataYmd: ymdFromDbDate(c.data),
      tema: c.tema,
      autoresLabel,
      hyperlink: c.hyperlink,
      authorIds,
    }
  })
}

export async function createEquipeChapter(
  input: z.infer<typeof createSchema>,
): Promise<{ error?: string; id?: string }> {
  try {
    await requireSession()
  } catch {
    return { error: "Não autenticado." }
  }

  try {
    const parsed = createSchema.safeParse(input)
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." }
    }
    const { tema, dataYmd, authorIds } = parsed.data
    const linkNorm = normalizeHyperlink(parsed.data.hyperlink)
    if (!linkNorm.ok) return { error: linkNorm.error }
    const hyperlink = linkNorm.value

    if (!isValidNewChapterDate(dataYmd)) {
      return { error: "Data inválida." }
    }

    const data = parseYmdToDbDate(dataYmd)
    if (!data) return { error: "Data inválida." }

    const allowed = await activeAuthorIdSet()
    const filteredAuthors = authorIds.filter((id) => allowed.has(id))
    if (filteredAuthors.length === 0) {
      return { error: "Selecione pelo menos um autor ativo." }
    }

    const created = await prisma.$transaction(async (tx: EquipeChapterDbTx) => {
      const ch = await tx.equipeChapter.create({
        data: { tema, data, hyperlink: hyperlink ?? null },
        select: { id: true },
      })
      await tx.equipeChapterAuthor.createMany({
        data: filteredAuthors.map((userId) => ({ chapterId: ch.id, userId })),
        skipDuplicates: true,
      })
      return ch
    })
    try {
      revalidatePath("/equipe")
    } catch (revErr) {
      console.error("[createEquipeChapter] revalidatePath", revErr)
    }
    return { id: created.id }
  } catch (e) {
    console.error("[createEquipeChapter]", e)
    return { error: "Não foi possível salvar o chapter." }
  }
}

export async function updateEquipeChapter(
  input: z.infer<typeof updateSchema>,
): Promise<{ error?: string }> {
  try {
    await requireAdmin()
  } catch {
    return { error: "Não autorizado." }
  }

  try {
    const parsed = updateSchema.safeParse(input)
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." }
    }
    const { id, tema, dataYmd, authorIds } = parsed.data
    const linkNorm = normalizeHyperlink(parsed.data.hyperlink)
    if (!linkNorm.ok) return { error: linkNorm.error }
    const hyperlink = linkNorm.value

    const existing = await prisma.equipeChapter.findUnique({
      where: { id },
      select: { data: true },
    })
    if (!existing) return { error: "Chapter não encontrado." }

    const prevYmd = ymdFromDbDate(existing.data)
    if (!isValidUpdatedChapterDate(dataYmd, prevYmd)) {
      return { error: "Data inválida." }
    }

    const data = parseYmdToDbDate(dataYmd)
    if (!data) return { error: "Data inválida." }

    const allowed = await activeAuthorIdSet()
    const filteredAuthors = authorIds.filter((aid) => allowed.has(aid))
    if (filteredAuthors.length === 0) {
      return { error: "Selecione pelo menos um autor ativo." }
    }

    await prisma.$transaction(async (tx: EquipeChapterDbTx) => {
      await tx.equipeChapterAuthor.deleteMany({ where: { chapterId: id } })
      await tx.equipeChapter.update({
        where: { id },
        data: { tema, data, hyperlink: hyperlink ?? null },
      })
      await tx.equipeChapterAuthor.createMany({
        data: filteredAuthors.map((userId) => ({ chapterId: id, userId })),
        skipDuplicates: true,
      })
    })
    try {
      revalidatePath("/equipe")
    } catch (revErr) {
      console.error("[updateEquipeChapter] revalidatePath", revErr)
    }
    return {}
  } catch (e) {
    console.error("[updateEquipeChapter]", e)
    return { error: "Não foi possível atualizar o chapter." }
  }
}

export async function deleteEquipeChapter(id: string): Promise<{ error?: string }> {
  try {
    await requireAdmin()
  } catch {
    return { error: "Não autorizado." }
  }

  const r = idSchema.safeParse(id)
  if (!r.success) return { error: "ID inválido." }

  try {
    await prisma.equipeChapter.delete({ where: { id } })
    try {
      revalidatePath("/equipe")
    } catch (revErr) {
      console.error("[deleteEquipeChapter] revalidatePath", revErr)
    }
    return {}
  } catch (e) {
    console.error("[deleteEquipeChapter]", e)
    return { error: "Não foi possível remover o chapter." }
  }
}
