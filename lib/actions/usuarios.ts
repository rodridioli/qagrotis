"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { MOCK_USERS } from "@/lib/qagrotis-constants"
import { PROTOTYPE_USERS } from "@/lib/prototype-users"
import { sendWelcomeEmail } from "@/lib/email"
import { nextId, verifyPassword, hashPassword } from "@/lib/db-utils"
import { requireAdmin, requireSession, checkIsAdmin } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export interface QaUserRecord {
  id: string
  name: string
  email: string
  type: string
  active: boolean
  photoPath: string | null
  createdAt?: number
}

export interface QaUserProfile {
  name: string
  email: string
  type: string
  photoPath: string | null
}

// ── Validation schemas ──────────────────────────────────────────────────────

const userInputSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(200),
  email: z.string().email("E-mail inválido").max(254),
  type: z.enum(["Padrão", "Administrador"]),
})

const idSchema = z.string().regex(/^U-\d+$/, "ID inválido")
const idsArraySchema = z.array(idSchema).max(1000)

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
  const [inactiveRecords, profiles, createdUsers, oauthUsers] = await Promise.all([
    prisma.inactiveUser.findMany({ select: { userId: true } }),
    prisma.userProfile.findMany(),
    prisma.createdUser.findMany({ orderBy: { createdAt: "asc" } }),
    // Include Google OAuth users not yet in createdUser (e.g. external domains)
    prisma.user.findMany({
      select: { id: true, name: true, email: true, createdAt: true, image: true },
      orderBy: { createdAt: "asc" },
    }),
  ])

  const inactiveIds = new Set(inactiveRecords.map((r) => r.userId))
  const profileMap = new Map(profiles.map((p) => [p.userId, p]))

  // Emails already covered by createdUser or mockUsers
  const knownEmails = new Set([
    ...MOCK_USERS.map((u) => u.email.toLowerCase()),
    ...createdUsers.map((u) => u.email.toLowerCase()),
  ])

  const mockRecords: QaUserRecord[] = MOCK_USERS.map((u) => {
    const p = profileMap.get(u.id)
    return {
      id:        u.id,
      name:      p?.name ?? u.name,
      email:     p?.email ?? u.email,
      type:      p?.type ?? u.type,
      active:    !inactiveIds.has(u.id) && u.active,
      photoPath: p?.photoPath ?? null,
    }
  })

  const createdRecords: QaUserRecord[] = createdUsers.map((u) => {
    const p = profileMap.get(u.id)
    return {
      id:        u.id,
      name:      p?.name ?? u.name,
      email:     p?.email ?? u.email,
      type:      p?.type ?? u.type,
      active:    !inactiveIds.has(u.id),
      photoPath: p?.photoPath ?? u.photoPath,
      createdAt: u.createdAt.getTime(),
    }
  })

  // OAuth-only users (Google login, external domain, not in createdUser)
  const oauthRecords: QaUserRecord[] = oauthUsers
    .filter((u) => u.email && !knownEmails.has(u.email.toLowerCase()))
    .map((u) => {
      const p = profileMap.get(u.id)
      return {
        id:        u.id,
        name:      p?.name ?? u.name ?? u.email ?? "",
        email:     p?.email ?? u.email ?? "",
        type:      p?.type ?? "Padrão",
        active:    !inactiveIds.has(u.id),
        photoPath: p?.photoPath ?? u.image ?? null,
        createdAt: u.createdAt.getTime(),
      }
    })

  return [...mockRecords, ...createdRecords, ...oauthRecords]
}

export async function getQaUserProfile(id: string): Promise<QaUserProfile | null> {
  const result = idSchema.safeParse(id)
  if (!result.success) return null

  const mockUser = MOCK_USERS.find((u) => u.id === id)

  const [savedProfile, createdUser] = await Promise.all([
    prisma.userProfile.findUnique({ where: { userId: id } }),
    prisma.createdUser.findUnique({ where: { id } }),
  ])

  const base = mockUser ?? createdUser
  if (!base) return null

  return {
    name:      savedProfile?.name ?? base.name,
    email:     savedProfile?.email ?? base.email,
    type:      savedProfile?.type ?? base.type,
    photoPath: savedProfile?.photoPath ?? (createdUser?.photoPath ?? null),
  }
}

export async function ativarQaUser(id: string): Promise<{ error?: string }> {
  try {
    await requireAdmin()
  } catch {
    return { error: "Não autorizado." }
  }
  const result = idSchema.safeParse(id)
  if (!result.success) return { error: "ID inválido." }

  try {
    const isInactive = await prisma.inactiveUser.findUnique({ where: { userId: id } })
    if (!isInactive) return { error: "Usuário não está inativo." }

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
  password: string
  photoPath?: string | null
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
    const [inactiveRecords, existingCreated] = await Promise.all([
      prisma.inactiveUser.findMany({ select: { userId: true } }),
      prisma.createdUser.findFirst({
        where: { email: { equals: parsed.email, mode: "insensitive" } },
        select: { id: true },
      }),
    ])

    const inactiveIds = new Set(inactiveRecords.map((r) => r.userId))

    // Block if email is already active (mock or created)
    const activeMockEmails = MOCK_USERS
      .filter((u) => !inactiveIds.has(u.id))
      .map((u) => u.email.toLowerCase())

    if (activeMockEmails.includes(parsed.email)) return { error: "E-mail já cadastrado." }
    if (existingCreated && !inactiveIds.has(existingCreated.id)) return { error: "E-mail já cadastrado." }

    const hashedPassword = hashPassword(data.password)

    let createdId = ""
    if (existingCreated && inactiveIds.has(existingCreated.id)) {
      // Reactivate existing inactive user
      await prisma.$transaction([
        prisma.createdUser.update({
          where: { id: existingCreated.id },
          data: { name: parsed.name, type: parsed.type, password: hashedPassword, photoPath: data.photoPath ?? null },
        }),
        prisma.inactiveUser.delete({ where: { userId: existingCreated.id } }),
      ])
      createdId = existingCreated.id
    } else {
      const createdIds = await prisma.createdUser.findMany({ select: { id: true } })
      const allIds = [...MOCK_USERS.map((u) => u.id), ...createdIds.map((u) => u.id)]
      const id = nextId(allIds, "U")
      await prisma.createdUser.create({
        data: { id, name: parsed.name, email: parsed.email, type: parsed.type, photoPath: data.photoPath ?? null, password: hashedPassword },
      })
      createdId = id
    }

    revalidatePath("/configuracoes/usuarios")
    return { 
      id: createdId, 
      emailEnviado: await sendAndGetStatus(parsed.email, parsed.name, data.password) 
    }
  } catch (e) {
    console.error("[criarQaUser]", e)
    return { error: "Erro ao criar usuário. Tente novamente." }
  }
}

async function sendAndGetStatus(email: string, name: string, pass: string): Promise<boolean> {
  try {
    await sendWelcomeEmail({ to: email, name, password: pass })
    return true
  } catch {
    console.warn(`[welcome] E-mail não enviado para ${email}.`)
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
    prisma.createdUser.findFirst({ where: { email: { equals: normalizedEmail, mode: "insensitive" } } }),
  ])

  const inactiveIds = new Set(inactiveRecords.map((r) => r.userId))

  if (createdUser) {
    if (!verifyPassword(password, createdUser.password)) return { ok: false, reason: "invalid_credentials" }
    if (inactiveIds.has(createdUser.id)) return { ok: false, reason: "inactive" }
    return { ok: true }
  }

  const mockUser = MOCK_USERS.find((u) => u.email.toLowerCase() === normalizedEmail)
  if (mockUser) {
    const expectedPassword = PROTOTYPE_USERS[normalizedEmail] ?? "admin"
    if (password !== expectedPassword) return { ok: false, reason: "invalid_credentials" }
    const profile = await prisma.userProfile.findUnique({ where: { userId: mockUser.id } })
    const emailMatch = (profile?.email ?? mockUser.email).toLowerCase() === normalizedEmail
    if (!emailMatch) return { ok: false, reason: "invalid_credentials" }
    if (inactiveIds.has(mockUser.id)) return { ok: false, reason: "inactive" }
    return { ok: true }
  }

  return { ok: false, reason: "invalid_credentials" }
}

export async function atualizarQaUser(
  id: string,
  data: { name: string; email: string; type: string; photoPath?: string | null }
): Promise<{ error?: string }> {
  let session: Awaited<ReturnType<typeof requireSession>>
  try {
    session = await requireSession()
  } catch {
    return { error: "Não autenticado." }
  }

  const idResult = idSchema.safeParse(id)
  if (!idResult.success) return { error: "ID inválido." }

  try {
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

    const profileData: { name: string; email: string; type: string; photoPath?: string | null } = {
      name:  parsed.name,
      email: parsed.email,
      type:  parsed.type,
    }
    if (safePhotoPath !== undefined) profileData.photoPath = safePhotoPath

    await prisma.userProfile.upsert({
      where:  { userId: id },
      create: { userId: id, name: parsed.name, email: parsed.email, type: parsed.type, photoPath: safePhotoPath ?? null },
      update: profileData,
    })

    revalidatePath("/configuracoes/usuarios")
    revalidatePath(`/configuracoes/usuarios/${id}`)
    revalidatePath(`/configuracoes/usuarios/${id}/editar`)
    return {}
  } catch (e) {
    console.error("[atualizarQaUser]", e)
    return { error: "Erro ao atualizar usuário. Tente novamente." }
  }
}
