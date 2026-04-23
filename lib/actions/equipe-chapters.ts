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
import { ensureEquipeChapterTables } from "@/lib/prisma-schema-ensure"
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

/** Autor na listagem de chapters (foto + nome; inclui inativos no histórico). */
export interface EquipeChapterAuthorDisplay {
  userId: string
  name: string
  photoPath: string | null
}

export interface EquipeChapterListRow {
  id: string
  edicao: number
  dataYmd: string
  tema: string
  autoresLabel: string
  hyperlink: string | null
  authorIds: string[]
  /** Ordem estável: mesma ordem persistida em `EquipeChapterAuthor` (createMany). */
  authors: EquipeChapterAuthorDisplay[]
}

/** Top 3 autores por quantidade de participações em chapters (1 ponto por chapter em que aparece). */
export interface EquipeChapterRankingRow {
  position: 1 | 2 | 3
  userId: string
  name: string
  photoPath: string | null
  points: number
}

function chapterPrismaUserMessage(e: unknown, fallback: string): string {
  const code = typeof e === "object" && e !== null && "code" in e ? String((e as { code: string }).code) : ""
  const msg = typeof e === "object" && e !== null && "message" in e ? String((e as { message: string }).message) : ""
  if (code === "P2021" || /does not exist|não existe|relation.*not exist/i.test(msg)) {
    return "Tabelas de chapters ainda não existem no banco. Recarregue a página; se persistir, rode as migrações Prisma no Neon."
  }
  return fallback
}

async function activeAuthorIdSet(): Promise<Set<string>> {
  const users = await getQaUsers()
  return new Set(users.filter((u) => u.active).map((u) => u.id))
}

/** Nome e foto para UI de chapters — inclui inativos (histórico). */
async function userDisplayMetaById(): Promise<Map<string, { name: string; photoPath: string | null }>> {
  const users = await getQaUsers()
  const m = new Map<string, { name: string; photoPath: string | null }>()
  for (const u of users) {
    const name = (u.name || u.email || u.id).trim() || u.id
    m.set(u.id, { name, photoPath: u.photoPath ?? null })
  }
  return m
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
  await ensureEquipeChapterTables()

  try {
    const chapters = (await prisma.equipeChapter.findMany({
      include: { authors: true },
      orderBy: [{ data: "asc" }, { createdAt: "asc" }],
    })) as EquipeChapterWithAuthors[]

    const meta = await userDisplayMetaById()
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
      const authors: EquipeChapterAuthorDisplay[] = authorIds.map((id: string) => {
        const row = meta.get(id)
        return {
          userId: id,
          name: row?.name ?? id,
          photoPath: row?.photoPath ?? null,
        }
      })
      const autoresLabel = [...authors]
        .map((a) => a.name)
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
        authors,
      }
    })
  } catch (e) {
    console.error("[listEquipeChapters]", e)
    return []
  }
}

/**
 * Ranking dos 3 autores com mais participações em chapters.
 * Cada linha em `EquipeChapterAuthor` conta 1 ponto para aquele `userId`.
 */
export async function getEquipeChapterAuthorRanking(): Promise<EquipeChapterRankingRow[]> {
  await requireSession()
  await ensureEquipeChapterTables()
  try {
    const links = await prisma.equipeChapterAuthor.findMany({ select: { userId: true } })
    const tally = new Map<string, number>()
    for (const { userId } of links) {
      tally.set(userId, (tally.get(userId) ?? 0) + 1)
    }
    if (tally.size === 0) return []

    const meta = await userDisplayMetaById()
    const sorted = [...tally.entries()]
      .map(([userId, points]) => ({
        userId,
        points,
        name: meta.get(userId)?.name ?? userId,
        photoPath: meta.get(userId)?.photoPath ?? null,
      }))
      .sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points
        return a.name.localeCompare(b.name, "pt-BR")
      })
      .slice(0, 3)

    return sorted.map((row, i) => ({
      position: (i + 1) as EquipeChapterRankingRow["position"],
      userId: row.userId,
      name: row.name,
      photoPath: row.photoPath,
      points: row.points,
    }))
  } catch (e) {
    console.error("[getEquipeChapterAuthorRanking]", e)
    return []
  }
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
    await ensureEquipeChapterTables()
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
    return { error: chapterPrismaUserMessage(e, "Não foi possível salvar o chapter.") }
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
    await ensureEquipeChapterTables()
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
    return { error: chapterPrismaUserMessage(e, "Não foi possível atualizar o chapter.") }
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
    await ensureEquipeChapterTables()
    await prisma.equipeChapter.delete({ where: { id } })
    try {
      revalidatePath("/equipe")
    } catch (revErr) {
      console.error("[deleteEquipeChapter] revalidatePath", revErr)
    }
    return {}
  } catch (e) {
    console.error("[deleteEquipeChapter]", e)
    return { error: chapterPrismaUserMessage(e, "Não foi possível remover o chapter.") }
  }
}
