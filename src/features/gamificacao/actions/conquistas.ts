"use server"

import { z } from "zod"
import { prisma } from "@/core/prisma"
import { requireSession } from "@/core/session"
import { buildRole, can } from "@/core/rbac/policy"
import {
  BADGE_DEFINITIONS,
  LANGUAGE_LEVEL_ORDER,
  type BadgeResult,
  type ListUserBadgesResponse,
} from "@/features/gamificacao/lib/conquistas"
import { createNotification } from "@/core/actions/notifications"

function monthsBetween(from: Date, to: Date): number {
  return (
    (to.getFullYear() - from.getFullYear()) * 12 +
    (to.getMonth() - from.getMonth())
  )
}

// Returns true if any education entry has a matching `type` field (exact, case-insensitive).
function hasEducationType(education: unknown, types: string[]): boolean {
  if (!Array.isArray(education)) return false
  return education.some((entry) => {
    if (!entry || typeof entry !== "object") return false
    const t = String((entry as Record<string, unknown>).type ?? "").toLowerCase()
    return types.some((type) => t === type.toLowerCase())
  })
}

// Fallback keyword check on the `title` field for legacy entries without `type`.
function hasEducationTitleKeyword(education: unknown, keywords: string[]): boolean {
  if (!Array.isArray(education)) return false
  return education.some((entry) => {
    if (!entry || typeof entry !== "object") return false
    const e = entry as Record<string, unknown>
    // Skip entries that already have a type field (handled by hasEducationType)
    if (e.type && String(e.type).trim() !== "") return false
    const title = String(e.title ?? "").toLowerCase()
    return keywords.some((kw) => title.includes(kw))
  })
}

function checkEducation(education: unknown, types: string[], titleKeywords: string[]): boolean {
  return hasEducationType(education, types) || hasEducationTitleKeyword(education, titleKeywords)
}

// Returns the 0-based index of the highest non-Portuguese language level, or -1 if none.
function bestNonPortugueseLanguageLevel(languages: unknown): number {
  if (!Array.isArray(languages)) return -1
  let best = -1
  for (const entry of languages) {
    if (!entry || typeof entry !== "object") continue
    const e = entry as Record<string, unknown>
    const name = String(e.name ?? "").toLowerCase().trim()
    if (name.includes("portugu")) continue
    if (!name) continue
    const level = String(e.level ?? "")
    const idx = LANGUAGE_LEVEL_ORDER.indexOf(level as (typeof LANGUAGE_LEVEL_ORDER)[number])
    if (idx > best) best = idx
  }
  return best
}

export async function listUserBadges(targetUserId?: string): Promise<ListUserBadgesResponse> {
  const session = await requireSession()

  let userId = session.user.id
  if (targetUserId && targetUserId !== session.user.id) {
    const role = buildRole(session.user.type, session.user.accessProfile)
    if (!can(role, "individual.viewOthers")) throw new Error("Sem permissão.")
    const parsed = z.string().min(1).max(128).safeParse(targetUserId)
    if (!parsed.success) throw new Error("ID de usuário inválido.")
    userId = parsed.data
  }
  const now = new Date()

  const [createdUser, chapterCount, positiveFeedbackCount, profile, oldestAdmissao] =
    await Promise.all([
      prisma.createdUser.findUnique({
        where: { id: userId },
        select: { createdAt: true, education: true, courses: true, certifications: true, languages: true },
      }),
      prisma.equipeChapterAuthor.count({ where: { userId } }),
      prisma.individualFeedback.count({
        where: { evaluatedUserId: userId, status: "CONCLUIDA", tipo: "POSITIVO" },
      }),
      prisma.userProfile.findUnique({
        where: { userId },
        select: { education: true, courses: true, certifications: true, languages: true },
      }),
      // Oldest ADMISSAO record drives tenure; raw SQL avoids stale-client issue
      prisma.$queryRaw<{ data: Date }[]>`
        SELECT data FROM "IndividualProgressao"
        WHERE "evaluatedUserId" = ${userId} AND tipo = 'ADMISSAO'
        ORDER BY data ASC
        LIMIT 1
      `.catch(() => [] as { data: Date }[]),
    ])

  const admissaoDate = oldestAdmissao[0]?.data ?? null
  const tenureMonths = admissaoDate ? monthsBetween(admissaoDate, now) : 0

  const education     = profile?.education     ?? createdUser?.education     ?? []
  const courses       = (profile?.courses       ?? createdUser?.courses       ?? []) as unknown[]
  const certifications = (profile?.certifications ?? createdUser?.certifications ?? []) as unknown[]
  const languages     = (profile?.languages     ?? createdUser?.languages     ?? []) as unknown[]

  const hasGraduacao  = checkEducation(education, ["Graduação"],    ["bacharel", "licenciatura", "gradua"])
  const hasPosGrad    = checkEducation(education, ["Pós-Graduação"], ["pós", "pos-", "especializ", "mba", "lato sensu"])
  const hasMestrado   = checkEducation(education, ["Mestrado"],     ["mestrado", "msc", "master", "stricto sensu"])
  const hasDoutorado  = checkEducation(education, ["Doutorado"],    ["doutorado", "phd", "ph.d", "doutora"])
  const hasPosDoutorado = checkEducation(education, ["Pós-Doutorado"], ["pós-dout", "pos-dout", "postdoc"])

  const bestLangLevel = bestNonPortugueseLanguageLevel(languages)

  const unlockedMap: Record<string, boolean> = {
    "tempo-6m":     tenureMonths >= 6,
    "tempo-1y":     tenureMonths >= 12,
    "tempo-2y":     tenureMonths >= 24,
    "tempo-5y":     tenureMonths >= 60,
    "tempo-8y":     tenureMonths >= 96,
    "tempo-10y":    tenureMonths >= 120,
    "tempo-15y":    tenureMonths >= 180,
    "chapter-1":    chapterCount >= 1,
    "chapter-5":    chapterCount >= 5,
    "chapter-10":   chapterCount >= 10,
    "chapter-15":   chapterCount >= 15,
    "chapter-20":   chapterCount >= 20,
    "fp-1":         positiveFeedbackCount >= 1,
    "fp-5":         positiveFeedbackCount >= 5,
    "fp-10":        positiveFeedbackCount >= 10,
    "fp-15":        positiveFeedbackCount >= 15,
    "fp-20":        positiveFeedbackCount >= 20,
    "fp-30":        positiveFeedbackCount >= 30,
    "fp-40":        positiveFeedbackCount >= 40,
    "form-grad":    hasGraduacao,
    "form-pos":     hasPosGrad,
    "form-cert":    Array.isArray(certifications) && certifications.length > 0,
    "form-cursos":  Array.isArray(courses) && courses.length >= 10,
    "form-mest":    hasMestrado,
    "form-dout":    hasDoutorado,
    "form-posdout": hasPosDoutorado,
    // Language badges: cumulative unlock from best non-Portuguese language level
    "lang-basic":   bestLangLevel >= 0,
    "lang-inter":   bestLangLevel >= 1,
    "lang-avanc":   bestLangLevel >= 2,
    "lang-fluente": bestLangLevel >= 3,
  }

  const badgeResults = BADGE_DEFINITIONS.map((def) => ({
    id: def.id,
    label: def.label ?? def.id,
    unlocked: unlockedMap[def.id] ?? false,
  }))

  // Detect newly unlocked badges and emit notifications (only for own profile, lazy detection)
  if (userId === session.user.id) {
    try {
      const persistedBadges = await prisma.userBadge.findMany({
        where: { userId },
        select: { badgeId: true },
      })
      const persistedIds = new Set(persistedBadges.map((b) => b.badgeId))

      for (const badge of badgeResults) {
        if (badge.unlocked && !persistedIds.has(badge.id)) {
          try {
            await prisma.userBadge.create({
              data: { userId, badgeId: badge.id },
            })
            await createNotification(
              userId,
              "ACHIEVEMENT",
              `Conquista desbloqueada: ${badge.label}`,
              `Você desbloqueou a conquista "${badge.label}". Parabéns!`,
              `/individual/conquistas`,
            )
          } catch {
            // @@unique([userId, badgeId]) ensures idempotency on race conditions
          }
        }
      }
    } catch (notifErr) {
      if (process.env.NODE_ENV !== "production")
        console.error("[listUserBadges] achievement trigger:", notifErr)
    }
  }

  return {
    badges: badgeResults.map(({ id, unlocked }) => ({ id, unlocked })),
    tenureMonths,
  }
}
