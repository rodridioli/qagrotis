"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { prisma } from "@/core/prisma"
import {
  isValidNewChapterDate,
  isValidUpdatedChapterDate,
  parseYmdToDbDate,
  ymdFromDbDate,
} from "@/features/equipe/lib/equipe-chapter-dates"
import { getQaUsers } from "@/features/usuarios/actions/usuarios"
import { ensureEquipeChapterTables } from "@/core/prisma-schema-ensure"
import { requireAdmin, requireSession } from "@/core/session"
import {
  EQUIPE_CHAPTER_RANKING_PAGE_SIZE,
  type EquipeChapterAuthorDisplay,
  type EquipeChapterAuthorOption,
  type EquipeChapterListRow,
  type EquipeChapterRatingEntry,
  type EquipeChapterRankingPage,
  type EquipeChapterRankingRow,
} from "@/features/equipe/lib/equipe-chapters-shared"

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

/** Nome, foto e flag ativo para UI de chapters — inclui inativos (histórico). */
async function userDisplayMetaById(): Promise<
  Map<string, { name: string; photoPath: string | null; active: boolean }>
> {
  const users = await getQaUsers()
  const m = new Map<string, { name: string; photoPath: string | null; active: boolean }>()
  for (const u of users) {
    const name = (u.name || u.email || u.id).trim() || u.id
    m.set(u.id, { name, photoPath: u.photoPath ?? null, active: u.active })
  }
  return m
}

/** Autores ativos para multi-select (mesma base que /configuracoes/usuarios). */
export async function listEquipeChapterAuthorOptions(): Promise<EquipeChapterAuthorOption[]> {
  try {
    await requireSession()
    const users = await getQaUsers()
    return users
      .filter((u) => u.active)
      .map((u) => ({ id: u.id, name: (u.name || u.email || u.id).trim() || u.id }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
  } catch (e) {
    console.error("[listEquipeChapterAuthorOptions]", e)
    return []
  }
}

export async function listEquipeChapters(): Promise<EquipeChapterListRow[]> {
  try {
    await requireSession()
    await ensureEquipeChapterTables()
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

    const ratingAgg = new Map<string, { sum: number; count: number }>()
    try {
      const ratingRows = await prisma.equipeChapterRating.findMany({
        select: { chapterId: true, stars: true },
      })
      for (const rr of ratingRows) {
        const cur = ratingAgg.get(rr.chapterId) ?? { sum: 0, count: 0 }
        cur.sum += rr.stars
        cur.count += 1
        ratingAgg.set(rr.chapterId, cur)
      }
    } catch {
      /* tabela ainda inexistente ou erro transitório */
    }

    return rowsDesc.map((c: EquipeChapterWithAuthors) => {
      const authorIds = c.authors.map((a: EquipeChapterAuthorLink) => a.userId)
      const authors: EquipeChapterAuthorDisplay[] = authorIds.map((id: string) => {
        const row = meta.get(id)
        return {
          userId: id,
          name: row?.name ?? id,
          photoPath: row?.photoPath ?? null,
          active: row?.active ?? true,
        }
      })
      const autoresLabel = [...authors]
        .map((a) => a.name)
        .sort((a: string, b: string) => a.localeCompare(b, "pt-BR"))
        .join(", ")
      const agg = ratingAgg.get(c.id)
      const ratingCount = agg?.count ?? 0
      const ratingAvg = ratingCount > 0 ? agg!.sum / ratingCount : null
      return {
        id: c.id,
        edicao: editionById.get(c.id) ?? 0,
        dataYmd: ymdFromDbDate(c.data),
        tema: c.tema,
        autoresLabel,
        hyperlink: c.hyperlink,
        authorIds,
        authors,
        ratingAvg,
        ratingCount,
      }
    })
  } catch (e) {
    console.error("[listEquipeChapters]", e)
    return []
  }
}

/** Busca o total de pontos gastos em resgates por userId (retorna Map). */
async function getSpentPointsByUserId(): Promise<Map<string, number>> {
  try {
    const redemptions = await prisma.chapterRedemption.findMany({
      select: { userId: true, costPoints: true },
    })
    const spent = new Map<string, number>()
    for (const { userId, costPoints } of redemptions) {
      spent.set(userId, (spent.get(userId) ?? 0) + costPoints)
    }
    return spent
  } catch {
    return new Map()
  }
}

/**
 * Ranking paginado: chapterCount = participações como autor; points = saldo após resgates.
 * `page` é 1-based; `pageSize` fixo (`EQUIPE_CHAPTER_RANKING_PAGE_SIZE` em `lib/equipe-chapters-shared`).
 */
export async function getEquipeChapterAuthorRankingPage(
  page: number = 1,
): Promise<EquipeChapterRankingPage> {
  const pageSize = EQUIPE_CHAPTER_RANKING_PAGE_SIZE
  const empty = (): EquipeChapterRankingPage => ({
    rows: [],
    page: 1,
    pageSize,
    totalItems: 0,
    totalPages: 1,
  })

  try {
    const session = await requireSession()
    const sessionUserId = (session.user?.id ?? "").trim()
    const sessionEmail = (session.user?.email ?? "").trim().toLowerCase()
    await ensureEquipeChapterTables()

    const [links, spentMap] = await Promise.all([
      prisma.equipeChapterAuthor.findMany({ select: { userId: true } }),
      getSpentPointsByUserId(),
    ])

    const tally = new Map<string, number>()
    for (const { userId } of links) {
      tally.set(userId, (tally.get(userId) ?? 0) + 1)
    }
    if (tally.size === 0) return empty()

    // Collect ALL possible IDs for the logged-in user so isCurrentUser is reliable even when
    // EquipeChapterAuthor.userId was stored with an OAuth UUID before the createdUser record existed.
    const currentUserIds = new Set<string>()
    if (sessionUserId) currentUserIds.add(sessionUserId)
    if (sessionEmail) {
      try {
        const [cu, oauthUser] = await Promise.all([
          prisma.createdUser.findFirst({
            where: { email: { equals: sessionEmail, mode: "insensitive" } },
            select: { id: true },
          }),
          prisma.user.findFirst({
            where: { email: { equals: sessionEmail, mode: "insensitive" } },
            select: { id: true },
          }).catch(() => null),
        ])
        if (cu) currentUserIds.add(cu.id)
        if (oauthUser) currentUserIds.add(oauthUser.id)
      } catch { /* keep sessionUserId */ }
    }

    const meta = await userDisplayMetaById()
    const sorted = [...tally.entries()]
      .map(([userId, chapterCount]) => {
        const spent = spentMap.get(userId) ?? 0
        return {
          userId,
          chapterCount,
          points: Math.max(0, chapterCount - spent),
          name: meta.get(userId)?.name ?? userId,
          photoPath: meta.get(userId)?.photoPath ?? null,
          active: meta.get(userId)?.active ?? true,
        }
      })
      .sort((a, b) => {
        if (b.chapterCount !== a.chapterCount) return b.chapterCount - a.chapterCount
        if (b.points !== a.points) return b.points - a.points
        return a.name.localeCompare(b.name, "pt-BR")
      })

    const totalItems = sorted.length
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
    const safePage =
      typeof page === "number" && Number.isFinite(page) && page >= 1
        ? Math.min(Math.floor(page), totalPages)
        : 1
    const start = (safePage - 1) * pageSize
    const slice = sorted.slice(start, start + pageSize)
    const rows: EquipeChapterRankingRow[] = slice.map((row, i) => ({
      position: start + i + 1,
      userId: row.userId,
      name: row.name,
      photoPath: row.photoPath,
      active: row.active,
      chapterCount: row.chapterCount,
      points: row.points,
      isCurrentUser: currentUserIds.has(row.userId),
    }))

    return { rows, page: safePage, pageSize, totalItems, totalPages }
  } catch (e) {
    console.error("[getEquipeChapterAuthorRankingPage]", e)
    return empty()
  }
}

/** Resolve todos os IDs possíveis do usuário logado (createdUser + oauth user). */
async function resolveCurrentUserIds(session: Awaited<ReturnType<typeof requireSession>>): Promise<string[]> {
  const sessionId = (session.user?.id ?? "").trim()
  const sessionEmail = (session.user?.email ?? "").trim().toLowerCase()
  const ids = new Set<string>()
  if (sessionId) ids.add(sessionId)
  if (sessionEmail) {
    try {
      const [cu, oauthUser] = await Promise.all([
        prisma.createdUser.findFirst({
          where: { email: { equals: sessionEmail, mode: "insensitive" } },
          select: { id: true },
        }),
        prisma.user.findFirst({
          where: { email: { equals: sessionEmail, mode: "insensitive" } },
          select: { id: true },
        }).catch(() => null),
      ])
      if (cu) ids.add(cu.id)
      if (oauthUser) ids.add(oauthUser.id)
    } catch { /* keep sessionId */ }
  }
  return [...ids]
}

/** Retorna o saldo de pontos do usuário logado. */
export async function getMyChapterBalance(): Promise<{ chapterCount: number; spent: number; points: number }> {
  const session = await requireSession()
  const userIds = await resolveCurrentUserIds(session)

  const [links, redemptions] = await Promise.all([
    prisma.equipeChapterAuthor.findMany({ where: { userId: { in: userIds } }, select: { userId: true } }),
    prisma.chapterRedemption.findMany({ where: { userId: { in: userIds } }, select: { costPoints: true } }),
  ])
  const chapterCount = links.length
  const spent = redemptions.reduce((acc: number, r: { costPoints: number }) => acc + r.costPoints, 0)
  return { chapterCount, spent, points: Math.max(0, chapterCount - spent) }
}

/** Resgata um prêmio para o usuário logado. */
export async function redeemChapterPrize(
  prizeId: string,
): Promise<{ ok: true; newPoints: number } | { error: string }> {
  const { findPrize } = await import("@/features/equipe/lib/chapter-prizes")
  const { createNotification } = await import("@/core/actions/notifications")

  let session
  try { session = await requireSession() } catch { return { error: "Não autenticado." } }

  const userId = session.user?.id ?? ""
  const prize = findPrize(prizeId)
  if (!prize) return { error: "Prêmio inválido." }

  const balance = await getMyChapterBalance()
  if (balance.points < prize.costPoints) {
    return { error: `Saldo insuficiente. Você tem ${balance.points} pts e o prêmio custa ${prize.costPoints} pts.` }
  }

  await prisma.chapterRedemption.create({
    data: {
      id: `RDM-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      userId,
      prizeId: prize.id,
      prizeLabel: prize.label,
      costPoints: prize.costPoints,
    },
  })

  // Notifica todos os Administrador:MGR ativos
  try {
    const userName = session.user?.name ?? session.user?.email ?? userId
    const mgrs = await prisma.createdUser.findMany({
      where: { accessProfile: "MGR" },
      select: { id: true },
    })
    await Promise.all(
      mgrs.map((mgr) =>
        createNotification(
          mgr.id,
          "ACHIEVEMENT",
          "Solicitação de prêmio",
          `${userName} solicitou o prêmio "${prize.label}" (${prize.costPoints} pts).`,
          "/equipe?tab=chapters",
        ),
      ),
    )
  } catch (e) {
    console.error("[redeemChapterPrize] notificação falhou", e)
  }

  revalidatePath("/equipe")
  return { ok: true, newPoints: balance.points - prize.costPoints }
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
    const existingLinks = await prisma.equipeChapterAuthor.findMany({
      where: { chapterId: id },
      select: { userId: true },
    })
    const inactiveAlreadyOnChapter = new Set(
      existingLinks.map((l) => l.userId).filter((uid) => !allowed.has(uid)),
    )
    const finalAuthorIds: string[] = []
    const seen = new Set<string>()
    for (const uid of authorIds) {
      if (seen.has(uid)) continue
      if (allowed.has(uid)) {
        finalAuthorIds.push(uid)
        seen.add(uid)
      } else if (inactiveAlreadyOnChapter.has(uid)) {
        finalAuthorIds.push(uid)
        seen.add(uid)
      }
    }
    if (!finalAuthorIds.some((uid) => allowed.has(uid))) {
      return { error: "Selecione pelo menos um autor ativo." }
    }

    await prisma.$transaction(async (tx: EquipeChapterDbTx) => {
      await tx.equipeChapterAuthor.deleteMany({ where: { chapterId: id } })
      await tx.equipeChapter.update({
        where: { id },
        data: { tema, data, hyperlink: hyperlink ?? null },
      })
      await tx.equipeChapterAuthor.createMany({
        data: finalAuthorIds.map((userId) => ({ chapterId: id, userId })),
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

const ratingCreateSchema = z.object({
  chapterId: idSchema,
  stars: z.coerce.number().int().min(0, "Avaliação mínima: 0 estrelas.").max(5, "Avaliação máxima: 5 estrelas."),
  comment: z.string().max(2000, "Comentário muito longo.").optional().default(""),
})

export async function listChapterRatings(chapterId: string): Promise<EquipeChapterRatingEntry[]> {
  try {
    const session = await requireSession()
    const myId = session.user?.id ?? ""
    await ensureEquipeChapterTables()
    const r = idSchema.safeParse(chapterId)
    if (!r.success) return []

    const rows = await prisma.equipeChapterRating.findMany({
      where: { chapterId },
      orderBy: { createdAt: "desc" },
      select: { id: true, stars: true, comment: true, createdAt: true, userId: true },
    })
    return rows.map((row) => ({
      id: row.id,
      stars: row.stars,
      comment: row.comment,
      createdAt: row.createdAt.toISOString(),
      isMine: Boolean(myId && row.userId === myId),
    }))
  } catch (e) {
    console.error("[listChapterRatings]", e)
    return []
  }
}

export async function createChapterRating(
  input: z.infer<typeof ratingCreateSchema>,
): Promise<{ error?: string }> {
  try {
    const session = await requireSession()
    const uid = session.user?.id
    if (!uid) return { error: "Não autenticado." }
    await ensureEquipeChapterTables()
    const parsed = ratingCreateSchema.safeParse(input)
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." }
    }
    const { chapterId, stars, comment } = parsed.data
    const exists = await prisma.equipeChapter.findUnique({
      where: { id: chapterId },
      select: { id: true },
    })
    if (!exists) return { error: "Chapter não encontrado." }

    const trimmedComment = (comment ?? "").trim()
    await prisma.equipeChapterRating.upsert({
      where: {
        chapterId_userId: { chapterId, userId: uid },
      },
      create: {
        chapterId,
        userId: uid,
        stars,
        comment: trimmedComment,
      },
      update: {
        stars,
        comment: trimmedComment,
      },
    })
    try {
      revalidatePath("/equipe")
    } catch (revErr) {
      console.error("[createChapterRating] revalidatePath", revErr)
    }
    return {}
  } catch (e) {
    console.error("[createChapterRating]", e)
    return { error: chapterPrismaUserMessage(e, "Não foi possível guardar a avaliação.") }
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
