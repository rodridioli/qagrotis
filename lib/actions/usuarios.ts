"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { sendInviteEmail } from "@/lib/email"
import { gerarConvite } from "@/lib/actions/invite-tokens"
import { nextId, verifyPassword, hashPassword } from "@/lib/db-utils"
import { requireAdmin, requireSession, checkIsAdmin } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import {
  CREATED_USER_READ_SELECT,
  USER_PROFILE_READ_SELECT,
} from "@/lib/prisma-user-selects"
import {
  ensureUserDataNascimentoColumns,
  ensureUserHybridWorkDaysColumns,
  ensureUserWorkScheduleColumns,
  ensureUserExtendedProfileColumns,
} from "@/lib/prisma-schema-ensure"
import {
  diasTrabalhoHibridoForStorage,
  normalizeDiasTrabalhoHibrido,
  parseHorarioInput,
  sanitizeFormatoTrabalho,
} from "@/lib/usuario-trabalho"

export interface QaUserRecord {
  id: string
  name: string
  email: string
  type: string
  accessProfile?: "QA" | "UX" | "TW" | "MGR" | null
  classificacao?: string | null
  active: boolean
  photoPath: string | null
  createdAt?: number
}

export interface QaUserProfile {
  name: string
  email: string
  type: string
  accessProfile?: "QA" | "UX" | "TW" | "MGR" | null
  classificacao?: string | null
  photoPath: string | null
  /** ISO `yyyy-mm-dd` quando definida */
  dataNascimento?: string | null
  /** `HH:mm` quando definido */
  horarioEntrada?: string | null
  horarioSaida?: string | null
  formatoTrabalho?: string | null
  /** Dias presenciais no modo Híbrido (ids `seg`…`dom`); vazio fora do modo Híbrido. */
  diasTrabalhoHibrido: string[]

  // Novos campos (Endereço e Contato)
  cep?: string | null
  address?: string | null
  addressNumber?: string | null
  neighborhood?: string | null
  country?: string | null
  state?: string | null
  city?: string | null
  phone?: string | null
  emergencyContact?: string | null
  instagram?: string | null
  linkedin?: string | null

  // Novos campos (Listas)
  education?: any[] | null
  courses?: any[] | null
  languages?: any[] | null
  certifications?: any[] | null
  careerHistory?: any[] | null
}

// ── Validation schemas ──────────────────────────────────────────────────────

const userInputSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(200),
  email: z.string().email("E-mail inválido").max(254),
  type: z.enum(["Padrão", "Administrador"]),
})

const MAX_CLASSIFICACAO_LEN = 120

/** Cargo / classificação: texto livre (rótulo na UI: "Cargo"). */
function sanitizeClassificacao(value: string | null | undefined): string | null {
  if (!value) return null
  const v = value.trim()
  if (!v) return null
  return v.slice(0, MAX_CLASSIFICACAO_LEN)
}

function toDateInputValue(d: Date | null | undefined): string {
  if (!d) return ""
  return d.toISOString().slice(0, 10)
}

function parseDateInput(s: string | null | undefined): Date | null {
  const t = s?.trim()
  if (!t || !/^\d{4}-\d{2}-\d{2}$/.test(t)) return null
  const d = new Date(`${t}T12:00:00.000Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Uma linha por e-mail: prioridade CreatedUser > OAuth; IDs sem e-mail entram uma vez. */
function mergeQaUsersByEmail(createdRecords: QaUserRecord[], oauthRecords: QaUserRecord[]): QaUserRecord[] {
  const byEmail = new Map<string, QaUserRecord>()
  for (const r of oauthRecords) {
    if (r.email?.trim()) byEmail.set(r.email.toLowerCase(), r)
  }
  for (const r of createdRecords) {
    if (r.email?.trim()) byEmail.set(r.email.toLowerCase(), r)
  }
  const merged = [...byEmail.values()]
  const seenIds = new Set(merged.map((u) => u.id))
  for (const r of [...createdRecords, ...oauthRecords]) {
    if (!seenIds.has(r.id)) {
      merged.push(r)
      seenIds.add(r.id)
    }
  }
  return merged
}

/** IDs de CreatedUser (U-…) ou NextAuth User (cuid). */
const userIdSchema = z.string().min(1).max(128)
const idsArraySchema = z.array(userIdSchema).max(1000)

/**
 * Validate that a photo path is either:
 * - A base64 data URL for an image (data:image/[type];base64,...)
 * - A safe URL path within /uploads/ (legacy filesystem avatars)
 * Prevents path traversal and XSS from arbitrary data URIs.
 */
function validatePhotoPath(photoPath: string | null | undefined): string | null {
  if (!photoPath) return null
  // Accept base64 data URLs produced by the avatar upload route
  if (photoPath.startsWith("data:")) {
    if (!/^data:image\/(jpeg|png|webp|gif);base64,/.test(photoPath)) {
      throw new Error("Caminho de foto inválido.")
    }
    return photoPath
  }
  // Accept legacy filesystem paths under /uploads/
  if (
    !photoPath.startsWith("/uploads/") ||
    photoPath.includes("..") ||
    !/^\/uploads\/[-A-Za-z0-9/_. ]+$/.test(photoPath)
  ) {
    throw new Error("Caminho de foto inválido.")
  }
  return photoPath
}

// ── Public actions ─────────────────────────────────────────────────────────

export async function getQaUsers(): Promise<QaUserRecord[]> {
  await ensureUserDataNascimentoColumns()
  await ensureUserWorkScheduleColumns()
  await ensureUserHybridWorkDaysColumns()
  await ensureUserExtendedProfileColumns()
  const [inactiveRecords, profiles, createdUsers, oauthUsers] = await Promise.all([
    prisma.inactiveUser.findMany({ select: { userId: true } }),
    prisma.userProfile.findMany({ select: USER_PROFILE_READ_SELECT }),
    prisma.createdUser.findMany({
      orderBy: { createdAt: "asc" },
      select: CREATED_USER_READ_SELECT,
    }),
    // Include Google OAuth users not yet in createdUser (e.g. external domains)
    prisma.user.findMany({
      select: { id: true, name: true, email: true, createdAt: true, image: true },
      orderBy: { createdAt: "asc" },
    }),
  ])

  const inactiveIds = new Set(inactiveRecords.map((r) => r.userId))
  const profileMap = new Map(profiles.map((p) => [p.userId, p]))

  const knownEmails = new Set(createdUsers.map((u) => u.email.toLowerCase()))

  const createdRecords: QaUserRecord[] = createdUsers.map((u) => {
    const p = profileMap.get(u.id)
    return {
      id:            u.id,
      name:          p?.name ?? u.name,
      email:         p?.email ?? u.email,
      type:          p?.type ?? u.type,
      accessProfile: (p?.accessProfile ?? u.accessProfile ?? null) as "QA" | "UX" | "TW" | "MGR" | null,
      classificacao: sanitizeClassificacao(p?.classificacao ?? u.classificacao ?? null),
      active:        !inactiveIds.has(u.id),
      photoPath:     p?.photoPath ?? u.photoPath,
      createdAt:     u.createdAt != null ? u.createdAt.getTime() : Date.now(),
    }
  })

  // OAuth-only users (Google login, external domain, not in createdUser)
  const oauthRecords: QaUserRecord[] = oauthUsers
    .filter((u) => u.email && !knownEmails.has(u.email.toLowerCase()))
    .map((u) => {
      const p = profileMap.get(u.id)
      return {
        id:            u.id,
        name:          p?.name ?? u.name ?? u.email ?? "",
        email:         p?.email ?? u.email ?? "",
        type:          p?.type ?? "Padrão",
        accessProfile: (p?.accessProfile ?? null) as "QA" | "UX" | "TW" | "MGR" | null,
        classificacao: sanitizeClassificacao(p?.classificacao ?? null),
        active:        !inactiveIds.has(u.id),
        photoPath:     p?.photoPath ?? u.image ?? null,
        createdAt:     u.createdAt != null ? u.createdAt.getTime() : Date.now(),
      }
    })

  return mergeQaUsersByEmail(createdRecords, oauthRecords)
}

async function resolveEmailForQaUserId(id: string): Promise<string | null> {
  const row = await prisma.createdUser.findUnique({ where: { id }, select: { email: true } })
  if (row?.email?.trim()) return row.email.trim().toLowerCase()
  const auth = await prisma.user.findUnique({ where: { id }, select: { email: true } })
  if (auth?.email?.trim()) return auth.email.trim().toLowerCase()
  return null
}

/** Outro cadastro (CreatedUser ou OAuth) com o mesmo e-mail já ativo — reativação geraria duplicidade. */
async function hasActiveOtherWithSameEmail(excludeUserId: string, emailNorm: string): Promise<boolean> {
  // Run all three queries in parallel to avoid sequential round-trips
  const [inactiveRows, otherCreated, otherAuth] = await Promise.all([
    prisma.inactiveUser.findMany({ select: { userId: true } }),
    prisma.createdUser.findFirst({
      where: { email: { equals: emailNorm, mode: "insensitive" }, NOT: { id: excludeUserId } },
      select: { id: true },
    }),
    prisma.user.findFirst({
      where: { email: { equals: emailNorm, mode: "insensitive" }, NOT: { id: excludeUserId } },
      select: { id: true },
    }),
  ])

  const inactiveSet = new Set(inactiveRows.map((r) => r.userId))
  if (otherCreated && !inactiveSet.has(otherCreated.id)) return true
  if (otherAuth    && !inactiveSet.has(otherAuth.id))    return true
  return false
}

export async function getQaUserProfile(id: string): Promise<QaUserProfile | null> {
  const result = userIdSchema.safeParse(id)
  if (!result.success) return null

  await ensureUserDataNascimentoColumns()
  await ensureUserWorkScheduleColumns()
  await ensureUserHybridWorkDaysColumns()
  await ensureUserExtendedProfileColumns()

  const [savedProfile, createdUser, oauthUser] = await Promise.all([
    prisma.userProfile.findUnique({ where: { userId: id }, select: USER_PROFILE_READ_SELECT }),
    prisma.createdUser.findUnique({ where: { id }, select: CREATED_USER_READ_SELECT }),
    prisma.user.findUnique({ where: { id }, select: { name: true, email: true, image: true } }),
  ])

  const base =
    createdUser ??
    (oauthUser?.email
      ? {
          name: oauthUser.name ?? oauthUser.email,
          email: oauthUser.email,
          type: "Padrão" as const,
        }
      : null)
  if (!base) return null

  const dn = savedProfile?.dataNascimento ?? createdUser?.dataNascimento ?? null

  const formatoMerged =
    savedProfile?.formatoTrabalho ?? createdUser?.formatoTrabalho ?? null
  const formatoEff = sanitizeFormatoTrabalho(formatoMerged)
  const diasRaw = savedProfile?.diasTrabalhoHibrido ?? createdUser?.diasTrabalhoHibrido
  const diasTrabalhoHibrido =
    formatoEff === "Híbrido" ? normalizeDiasTrabalhoHibrido(diasRaw) : []

  return {
    name:            savedProfile?.name ?? base.name,
    email:           savedProfile?.email ?? base.email,
    type:            savedProfile?.type ?? base.type,
    accessProfile:   (savedProfile?.accessProfile ?? createdUser?.accessProfile ?? null) as "QA" | "UX" | "TW" | "MGR" | null,
    classificacao:   sanitizeClassificacao(savedProfile?.classificacao ?? (createdUser?.classificacao ?? null)),
    photoPath:       savedProfile?.photoPath ?? (createdUser?.photoPath ?? oauthUser?.image ?? null),
    dataNascimento:  dn ? toDateInputValue(dn) : null,
    horarioEntrada:  savedProfile?.horarioEntrada ?? createdUser?.horarioEntrada ?? null,
    horarioSaida:    savedProfile?.horarioSaida ?? createdUser?.horarioSaida ?? null,
    formatoTrabalho: formatoMerged,
    diasTrabalhoHibrido,
  }

  // ── Controle de Acesso para Campos Sensíveis ───────────────────────────
  // Regra: Próprio usuário OU (Admin E Perfil MGR)
  let session: Awaited<ReturnType<typeof requireSession>> | null = null
  try {
    session = await requireSession()
  } catch {
    // Se não houver sessão, retornamos perfil básico sem campos sensíveis
  }

  const isSelf = session?.user?.id === id
  const isAdminMgr =
    session?.user?.type === "Administrador" &&
    (session?.user as any)?.accessProfile === "MGR"

  const canSeeRestricted = isSelf || isAdminMgr

  if (canSeeRestricted) {
    return {
      ...profile,
      cep:              savedProfile?.cep              ?? createdUser?.cep              ?? null,
      address:          savedProfile?.address          ?? createdUser?.address          ?? null,
      addressNumber:    savedProfile?.addressNumber    ?? createdUser?.addressNumber    ?? null,
      neighborhood:     savedProfile?.neighborhood     ?? createdUser?.neighborhood     ?? null,
      country:          savedProfile?.country          ?? createdUser?.country          ?? null,
      state:            savedProfile?.state            ?? createdUser?.state            ?? null,
      city:             savedProfile?.city             ?? createdUser?.city             ?? null,
      phone:            savedProfile?.phone            ?? createdUser?.phone            ?? null,
      emergencyContact: savedProfile?.emergencyContact ?? createdUser?.emergencyContact ?? null,
      instagram:        savedProfile?.instagram        ?? createdUser?.instagram        ?? null,
      linkedin:         savedProfile?.linkedin         ?? createdUser?.linkedin         ?? null,
      education:        (savedProfile?.education       ?? createdUser?.education        ?? []) as any[],
      courses:          (savedProfile?.courses         ?? createdUser?.courses          ?? []) as any[],
      languages:        (savedProfile?.languages       ?? createdUser?.languages        ?? []) as any[],
      certifications:   (savedProfile?.certifications  ?? createdUser?.certifications   ?? []) as any[],
      careerHistory:    (savedProfile?.careerHistory   ?? createdUser?.careerHistory    ?? []) as any[],
    }
  }

  return profile
}

export async function ativarQaUser(id: string): Promise<{ error?: string }> {
  try {
    await requireAdmin()
  } catch {
    return { error: "Não autorizado." }
  }
  const result = userIdSchema.safeParse(id)
  if (!result.success) return { error: "ID inválido." }

  try {
    const isInactive = await prisma.inactiveUser.findUnique({ where: { userId: id } })
    if (!isInactive) return { error: "Usuário não está inativo." }

    const email = await resolveEmailForQaUserId(id)
    if (!email) return { error: "Não foi possível identificar o e-mail deste cadastro." }

    if (await hasActiveOtherWithSameEmail(id, email)) {
      return {
        error:
          "Já existe um cadastro ativo com o mesmo e-mail. Não é possível reativar para evitar duplicidade.",
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.inactiveUser.delete({ where: { userId: id } })
      // For QaUser records (DB-stored), ensure active flag is set
      const qaUser = await tx.qaUser.findUnique({ where: { id } })
      if (qaUser) {
        await tx.qaUser.update({ where: { id }, data: { active: true } })
      }
    })

    revalidatePath("/configuracoes/usuarios")
    return {}
  } catch (e) {
    console.error("[ativarQaUser]", e)
    return { error: "Erro ao ativar usuário." }
  }
}

export async function inativarQaUsers(ids: string[]): Promise<{ error?: string }> {
  try {
    await requireAdmin()
  } catch {
    return { error: "Não autorizado." }
  }
  if (ids.length === 0) return {}
  const result = idsArraySchema.safeParse(ids)
  if (!result.success) return { error: "IDs inválidos." }

  try {
    // Protect against removing the last active admin
    const allUsers = await getQaUsers()
    const idsSet = new Set(ids)
    const activeAdmins = allUsers.filter((u) => u.active && u.type === "Administrador")
    const remainingActiveAdmins = activeAdmins.filter((u) => !idsSet.has(u.id))
    if (activeAdmins.length > 0 && remainingActiveAdmins.length === 0) {
      return { error: "É necessário manter pelo menos um administrador ativo no sistema." }
    }

    await prisma.inactiveUser.createMany({
      data: ids.map((userId) => ({ userId })),
      skipDuplicates: true,
    })
    revalidatePath("/configuracoes/usuarios")
    return {}
  } catch (e) {
    console.error("[inativarQaUsers]", e)
    return { error: "Erro ao inativar usuários." }
  }
}

export async function criarQaUser(data: {
  name: string
  email: string
  type: string
  accessProfile?: "QA" | "UX" | "TW" | "MGR"
  classificacao?: string | null
  dataNascimento?: string | null
  horarioEntrada?: string | null
  horarioSaida?: string | null
  formatoTrabalho?: string | null
  diasTrabalhoHibrido?: string[]
  password: string
  photoPath?: string | null

  // Novos campos
  cep?: string | null
  address?: string | null
  addressNumber?: string | null
  neighborhood?: string | null
  country?: string | null
  state?: string | null
  city?: string | null
  phone?: string | null
  emergencyContact?: string | null
  instagram?: string | null
  linkedin?: string | null
  education?: any[] | null
  courses?: any[] | null
  languages?: any[] | null
  certifications?: any[] | null
  careerHistory?: any[] | null
}): Promise<{ id?: string; error?: string; emailEnviado?: boolean }> {
  // Auth — return error instead of throwing so Next.js error boundary isn't triggered
  try {
    await requireAdmin()
  } catch {
    return { error: "Não autorizado." }
  }

  if (!data.password || data.password.length < 8) {
    return { error: "A senha deve ter no mínimo 8 caracteres." }
  }
  if (data.password.length > 100) {
    return { error: "Senha muito longa." }
  }
  if (!/[A-Z]/.test(data.password)) {
    return { error: "A senha deve conter ao menos uma letra maiúscula." }
  }
  if (!/[0-9]/.test(data.password)) {
    return { error: "A senha deve conter ao menos um número." }
  }
  if (!/[^A-Za-z0-9]/.test(data.password)) {
    return { error: "A senha deve conter ao menos um caractere especial (ex: @, #, !)." }
  }

  let parsed: { name: string; email: string; type: "Padrão" | "Administrador" }
  try {
    parsed = userInputSchema.parse({
      name:  data.name.trim(),
      email: data.email.trim().toLowerCase(),
      type:  data.type,
    })
  } catch (e) {
    if (e instanceof z.ZodError) return { error: e.issues[0]?.message ?? "Dados inválidos." }
    return { error: "Dados inválidos." }
  }

  try {
    await ensureUserDataNascimentoColumns()
    await ensureUserWorkScheduleColumns()
    await ensureUserHybridWorkDaysColumns()

    const [inactiveRecords, existingCreated] = await Promise.all([
      prisma.inactiveUser.findMany({ select: { userId: true } }),
      prisma.createdUser.findFirst({
        where: { email: { equals: parsed.email, mode: "insensitive" } },
        select: { id: true },
      }),
    ])

    const inactiveIds = new Set(inactiveRecords.map((r) => r.userId))

    const oauthExisting = await prisma.user.findFirst({
      where: { email: { equals: parsed.email, mode: "insensitive" } },
      select: { id: true },
    })
    if (oauthExisting && !inactiveIds.has(oauthExisting.id)) {
      return { error: "E-mail já cadastrado." }
    }
    if (existingCreated && !inactiveIds.has(existingCreated.id)) return { error: "E-mail já cadastrado." }

    const hashedPassword = hashPassword(data.password)
    const classificacaoValida = sanitizeClassificacao(data.classificacao)
    const dataNascimento = parseDateInput(data.dataNascimento ?? undefined)
    const horarioEntrada = parseHorarioInput(data.horarioEntrada ?? undefined)
    const horarioSaida = parseHorarioInput(data.horarioSaida ?? undefined)
    const formatoTrabalho = sanitizeFormatoTrabalho(data.formatoTrabalho ?? undefined)
    const diasTrabalhoHibrido = diasTrabalhoHibridoForStorage(formatoTrabalho, data.diasTrabalhoHibrido)

    const extendedData = {
      cep:              data.cep ?? null,
      address:          data.address ?? null,
      addressNumber:    data.addressNumber ?? null,
      neighborhood:     data.neighborhood ?? null,
      country:          data.country ?? null,
      state:            data.state ?? null,
      city:             data.city ?? null,
      phone:            data.phone ?? null,
      emergencyContact: data.emergencyContact ?? null,
      instagram:        data.instagram ?? null,
      linkedin:         data.linkedin ?? null,
      education:        data.education ?? [],
      courses:          data.courses ?? [],
      languages:        data.languages ?? [],
      certifications:   data.certifications ?? [],
      careerHistory:    data.careerHistory ?? [],
    }

    // Validação MGR + Administrador
    const validProfiles = ["QA", "UX", "TW", "MGR"] as const
    let resolvedAccessProfile: "QA" | "UX" | "TW" | "MGR" = (validProfiles as readonly string[]).includes(data.accessProfile ?? "") ? (data.accessProfile as "QA" | "UX" | "TW" | "MGR") : "QA"
    if (resolvedAccessProfile === "MGR" && parsed.type !== "Administrador") {
      return { error: "Perfil MGR exige Tipo Administrador." }
    }

    let createdId = ""
    if (existingCreated && inactiveIds.has(existingCreated.id)) {
      // Reactivate existing inactive user
      await prisma.$transaction([
        prisma.createdUser.update({
          where: { id: existingCreated.id },
          data: {
            name: parsed.name,
            type: parsed.type,
            accessProfile: resolvedAccessProfile,
            classificacao: classificacaoValida,
            password: hashedPassword,
            photoPath: data.photoPath ?? null,
            dataNascimento,
            horarioEntrada,
            horarioSaida,
            formatoTrabalho,
            diasTrabalhoHibrido,
            ...extendedData,
          },
        }),
        prisma.inactiveUser.delete({ where: { userId: existingCreated.id } }),
      ])
      createdId = existingCreated.id
    } else {
      const createdIds = await prisma.createdUser.findMany({ select: { id: true } })
      const allIds = createdIds.map((u) => u.id)
      const id = nextId(allIds, "U")
      await prisma.createdUser.create({
        data: {
          id,
          name: parsed.name,
          email: parsed.email,
          type: parsed.type,
          accessProfile: resolvedAccessProfile,
          classificacao: classificacaoValida,
          photoPath: data.photoPath ?? null,
          password: hashedPassword,
          dataNascimento,
          horarioEntrada,
          horarioSaida,
          formatoTrabalho,
          diasTrabalhoHibrido,
          ...extendedData,
        },
      })
      createdId = id
    }

    revalidatePath("/configuracoes/usuarios")
    return {
      id: createdId,
      emailEnviado: await sendAndGetStatus(createdId, parsed.email, parsed.name),
    }
  } catch (e) {
    console.error("[criarQaUser]", e)
    return { error: "Erro ao criar usuário. Tente novamente." }
  }
}

async function sendAndGetStatus(userId: string, email: string, name: string): Promise<boolean> {
  try {
    const token = await gerarConvite(userId, email)
    await sendInviteEmail({ to: email, name, token })
    return true
  } catch {
    console.warn(`[invite] E-mail não enviado para ${email}.`)
    return false
  }
}

export async function validateLogin(
  email: string,
  password: string
): Promise<{ ok: true } | { ok: false; reason: "invalid_credentials" | "inactive" }> {
  const normalizedEmail = email.trim().toLowerCase()

  const [inactiveRecords, createdUser] = await Promise.all([
    prisma.inactiveUser.findMany({ select: { userId: true } }),
    prisma.createdUser.findFirst({
      where: { email: { equals: normalizedEmail, mode: "insensitive" } },
      select: { id: true, password: true },
    }),
  ])

  const inactiveIds = new Set(inactiveRecords.map((r) => r.userId))

  if (createdUser) {
    if (!verifyPassword(password, createdUser.password)) return { ok: false, reason: "invalid_credentials" }
    if (inactiveIds.has(createdUser.id)) return { ok: false, reason: "inactive" }
    return { ok: true }
  }

  return { ok: false, reason: "invalid_credentials" }
}

export async function atualizarQaUser(
  id: string,
  data: {
    name: string
    email: string
    type: string
    accessProfile?: "QA" | "UX" | "TW" | "MGR"
    classificacao?: string | null
    dataNascimento?: string | null
    horarioEntrada?: string | null
    horarioSaida?: string | null
    formatoTrabalho?: string | null
    /** Omitir = não alterar dias salvos. */
    diasTrabalhoHibrido?: string[]
    photoPath?: string | null
    /** Nova senha local (CreatedUser). Omitir ou vazio = não alterar. */
    newPassword?: string | null

    // Novos campos
    cep?: string | null
    address?: string | null
    addressNumber?: string | null
    neighborhood?: string | null
    country?: string | null
    state?: string | null
    city?: string | null
    phone?: string | null
    emergencyContact?: string | null
    instagram?: string | null
    linkedin?: string | null
    education?: any[] | null
    courses?: any[] | null
    languages?: any[] | null
    certifications?: any[] | null
    careerHistory?: any[] | null
  }
): Promise<{ error?: string }> {
  let session: Awaited<ReturnType<typeof requireSession>>
  try {
    session = await requireSession()
  } catch {
    return { error: "Não autenticado." }
  }

  const idResult = userIdSchema.safeParse(id)
  if (!idResult.success) return { error: "ID inválido." }

  try {
    await ensureUserDataNascimentoColumns()
    await ensureUserWorkScheduleColumns()
    await ensureUserHybridWorkDaysColumns()

    const isAdmin = await checkIsAdmin()
    const sessionEmail = session.user?.email?.toLowerCase() ?? ""

    const targetProfile = await getQaUserProfile(id)
    if (!targetProfile) return { error: "Usuário não encontrado." }

    // Non-admins can only edit their own profile
    if (!isAdmin && targetProfile.email.toLowerCase() !== sessionEmail) {
      return { error: "Não autorizado." }
    }

    // Non-admins cannot change user type (prevents privilege escalation)
    const type = isAdmin ? data.type : targetProfile.type

    // accessProfile: somente admin pode alterar; não-admin mantém o atual
    const validProfiles = ["QA", "UX", "TW", "MGR"] as const
    const currentProfile = (targetProfile as { accessProfile?: string }).accessProfile
    const incomingProfile = data.accessProfile && (validProfiles as readonly string[]).includes(data.accessProfile)
      ? data.accessProfile
      : undefined
    const resolvedAccessProfile = isAdmin && incomingProfile
      ? incomingProfile
      : (currentProfile as "QA" | "UX" | "TW" | "MGR" | undefined)
    if (resolvedAccessProfile === "MGR" && type !== "Administrador") {
      return { error: "Perfil MGR exige Tipo Administrador." }
    }

    const sessionUserId = session.user?.id
    const isSelf = sessionUserId === id
    const isAdminMgr = isAdmin && (session.user as any)?.accessProfile === "MGR"
    const canEditSensitive = isSelf || isAdminMgr

    const sensitiveData: Record<string, any> = {}
    if (canEditSensitive) {
      if (data.cep !== undefined)              sensitiveData.cep = data.cep
      if (data.address !== undefined)          sensitiveData.address = data.address
      if (data.addressNumber !== undefined)    sensitiveData.addressNumber = data.addressNumber
      if (data.neighborhood !== undefined)     sensitiveData.neighborhood = data.neighborhood
      if (data.country !== undefined)          sensitiveData.country = data.country
      if (data.state !== undefined)            sensitiveData.state = data.state
      if (data.city !== undefined)             sensitiveData.city = data.city
      if (data.phone !== undefined)            sensitiveData.phone = data.phone
      if (data.emergencyContact !== undefined) sensitiveData.emergencyContact = data.emergencyContact
      if (data.instagram !== undefined)        sensitiveData.instagram = data.instagram
      if (data.linkedin !== undefined)         sensitiveData.linkedin = data.linkedin
      if (data.education !== undefined)        sensitiveData.education = data.education
      if (data.courses !== undefined)          sensitiveData.courses = data.courses
      if (data.languages !== undefined)        sensitiveData.languages = data.languages
      if (data.certifications !== undefined)   sensitiveData.certifications = data.certifications
      if (data.careerHistory !== undefined)    sensitiveData.careerHistory = data.careerHistory
    }

    let parsed: { name: string; email: string; type: "Padrão" | "Administrador" }
    try {
      parsed = userInputSchema.parse({
        name:  data.name.trim(),
        email: data.email.trim().toLowerCase(),
        type,
      })
    } catch (e) {
      if (e instanceof z.ZodError) return { error: e.issues[0]?.message ?? "Dados inválidos." }
      return { error: "Dados inválidos." }
    }

    // Validate photo path to prevent directory traversal
    let safePhotoPath: string | null | undefined
    try {
      safePhotoPath = data.photoPath !== undefined ? validatePhotoPath(data.photoPath) : undefined
    } catch {
      return { error: "Caminho de foto inválido." }
    }

    const classificacaoValida = sanitizeClassificacao(data.classificacao)
    const dataNascimento =
      data.dataNascimento === undefined ? undefined : parseDateInput(data.dataNascimento)
    const horarioEntrada =
      data.horarioEntrada === undefined ? undefined : parseHorarioInput(data.horarioEntrada)
    const horarioSaida =
      data.horarioSaida === undefined ? undefined : parseHorarioInput(data.horarioSaida)
    const formatoTrabalho =
      data.formatoTrabalho === undefined ? undefined : sanitizeFormatoTrabalho(data.formatoTrabalho)

    const formatoParaDias =
      formatoTrabalho !== undefined
        ? formatoTrabalho
        : sanitizeFormatoTrabalho(targetProfile.formatoTrabalho) ?? "Presencial"

    let diasTrabalhoHibridoDb: string[] | null | undefined
    if (data.diasTrabalhoHibrido !== undefined) {
      diasTrabalhoHibridoDb = diasTrabalhoHibridoForStorage(formatoParaDias, data.diasTrabalhoHibrido)
    } else if (formatoTrabalho !== undefined && formatoTrabalho !== "Híbrido") {
      diasTrabalhoHibridoDb = null
    }

    const newPw = data.newPassword?.trim()
    if (newPw) {
      if (newPw.length < 8) return { error: "A nova senha deve ter no mínimo 8 caracteres." }
      if (newPw.length > 100) return { error: "Senha muito longa." }
    }

    const profileData: {
      name: string
      email: string
      type: string
      classificacao: string | null
      photoPath?: string | null
      dataNascimento?: Date | null
      horarioEntrada?: string | null
      horarioSaida?: string | null
      formatoTrabalho?: string | null
      diasTrabalhoHibrido?: string[] | null
      // Novos campos
      cep?: string | null
      address?: string | null
      addressNumber?: string | null
      neighborhood?: string | null
      country?: string | null
      state?: string | null
      city?: string | null
      phone?: string | null
      emergencyContact?: string | null
      instagram?: string | null
      linkedin?: string | null
      education?: any[] | null
      courses?: any[] | null
      languages?: any[] | null
      certifications?: any[] | null
      careerHistory?: any[] | null
    } = {
      name:          parsed.name,
      email:         parsed.email,
      type:          parsed.type,
      classificacao: classificacaoValida,
    }
    if (resolvedAccessProfile) (profileData as { accessProfile?: string }).accessProfile = resolvedAccessProfile
    if (safePhotoPath !== undefined) profileData.photoPath = safePhotoPath
    if (dataNascimento !== undefined) profileData.dataNascimento = dataNascimento
    if (horarioEntrada !== undefined) profileData.horarioEntrada = horarioEntrada
    if (horarioSaida !== undefined) profileData.horarioSaida = horarioSaida
    if (formatoTrabalho !== undefined) profileData.formatoTrabalho = formatoTrabalho
    if (diasTrabalhoHibridoDb !== undefined) profileData.diasTrabalhoHibrido = diasTrabalhoHibridoDb

    // Atribuição de campos sensíveis se o usuário tiver permissão
    Object.assign(profileData, sensitiveData)

    await prisma.userProfile.upsert({
      where:  { userId: id },
      create: {
        userId: id,
        name: parsed.name,
        email: parsed.email,
        type: parsed.type,
        accessProfile: resolvedAccessProfile ?? null,
        classificacao: classificacaoValida,
        photoPath: safePhotoPath ?? null,
        dataNascimento: dataNascimento ?? null,
        horarioEntrada: horarioEntrada ?? null,
        horarioSaida: horarioSaida ?? null,
        formatoTrabalho: formatoTrabalho ?? null,
        diasTrabalhoHibrido: diasTrabalhoHibridoDb !== undefined ? diasTrabalhoHibridoDb : null,
        ...sensitiveData,
      },
      update: profileData,
    })

    const createdRow = await prisma.createdUser.findUnique({ where: { id }, select: { id: true } })
    if (newPw && !createdRow) {
      return {
        error:
          "Este perfil não possui cadastro com senha local (ex.: conta só Google). Peça a um administrador para criar o usuário com senha ou use apenas o login Google.",
      }
    }

    if (createdRow) {
      await prisma.createdUser.update({
        where: { id },
        data: {
          name: parsed.name,
          email: parsed.email,
          type: parsed.type,
          ...(resolvedAccessProfile ? { accessProfile: resolvedAccessProfile } : {}),
          classificacao: classificacaoValida,
          ...(dataNascimento !== undefined ? { dataNascimento } : {}),
          ...(horarioEntrada !== undefined ? { horarioEntrada } : {}),
          ...(horarioSaida !== undefined ? { horarioSaida } : {}),
          ...(formatoTrabalho !== undefined ? { formatoTrabalho } : {}),
          ...(diasTrabalhoHibridoDb !== undefined ? { diasTrabalhoHibrido: diasTrabalhoHibridoDb } : {}),
          ...(safePhotoPath !== undefined ? { photoPath: safePhotoPath } : {}),
          ...(newPw ? { password: hashPassword(newPw) } : {}),
          ...sensitiveData,
        },
      })
    }

    revalidatePath("/configuracoes/usuarios")
    revalidatePath(`/configuracoes/usuarios/${id}`)
    revalidatePath(`/configuracoes/usuarios/${id}/editar`)
    return {}
  } catch (e) {
    console.error("[atualizarQaUser]", e)
    return { error: "Erro ao atualizar usuário. Tente novamente." }
  }
}
