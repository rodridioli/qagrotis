"use server"

import path from "path"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { MOCK_USERS } from "@/lib/qagrotis-constants"
import { PROTOTYPE_USERS } from "@/lib/prototype-users"
import { gerarConvite } from "@/lib/actions/invite-tokens"
import { sendInviteEmail } from "@/lib/email"
import { nextId, verifyPassword } from "@/lib/db-utils"
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

// Allowed uploads directory — photoPath must resolve inside it
const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads")

/**
 * Validate that a photo path is inside the allowed uploads directory.
 * Prevents path traversal attacks where a caller could store "../../../etc/passwd".
 */
function validatePhotoPath(photoPath: string | null | undefined): string | null {
  if (!photoPath) return null
  const resolved = path.resolve(photoPath)
  if (!resolved.startsWith(UPLOADS_DIR + path.sep) && resolved !== UPLOADS_DIR) {
    throw new Error("Caminho de foto inválido.")
  }
  return resolved
}

// ── Public actions ─────────────────────────────────────────────────────────

export async function getQaUsers(): Promise<QaUserRecord[]> {
  const [inactiveRecords, profiles, createdUsers] = await Promise.all([
    prisma.inactiveUser.findMany({ select: { userId: true } }),
    prisma.userProfile.findMany(),
    prisma.createdUser.findMany({ orderBy: { createdAt: "asc" } }),
  ])

  const inactiveIds = new Set(inactiveRecords.map((r) => r.userId))
  const profileMap = new Map(profiles.map((p) => [p.userId, p]))

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

  return [...mockRecords, ...createdRecords]
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

export async function inativarQaUsers(ids: string[]): Promise<void> {
  await requireAdmin()
  if (ids.length === 0) return
  idsArraySchema.parse(ids)

  await prisma.inactiveUser.createMany({
    data: ids.map((userId) => ({ userId })),
    skipDuplicates: true,
  })
  revalidatePath("/configuracoes/usuarios")
}

export async function criarQaUser(data: {
  name: string
  email: string
  type: string
}): Promise<void> {
  await requireAdmin()
  const parsed = userInputSchema.parse({
    name:  data.name.trim(),
    email: data.email.trim().toLowerCase(),
    type:  data.type,
  })

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

  if (activeMockEmails.includes(parsed.email)) {
    throw new Error("E-mail já cadastrado.")
  }
  if (existingCreated && !inactiveIds.has(existingCreated.id)) {
    throw new Error("E-mail já cadastrado.")
  }

  const createdIds = await prisma.createdUser.findMany({ select: { id: true } })
  const allIds = [...MOCK_USERS.map((u) => u.id), ...createdIds.map((u) => u.id)]
  const id = nextId(allIds, "U")

  // Store user without password — password is set via invite link
  await prisma.createdUser.create({
    data: { id, name: parsed.name, email: parsed.email, type: parsed.type, photoPath: null, password: "" },
  })

  // Generate invite token and send email (non-blocking — user is saved regardless)
  const token = await gerarConvite(id, parsed.email)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  try {
    await sendInviteEmail({ to: parsed.email, name: parsed.name, token })
  } catch {
    console.warn(
      `[invite] E-mail não enviado. Link de convite para ${parsed.email}:\n` +
      `${appUrl}/definir-senha/${token}`
    )
  }

  revalidatePath("/configuracoes/usuarios")
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
): Promise<void> {
  const session = await requireSession()
  idSchema.parse(id)

  const isAdmin = await checkIsAdmin()
  const sessionEmail = session.user?.email?.toLowerCase() ?? ""

  const targetProfile = await getQaUserProfile(id)
  if (!targetProfile) throw new Error("Usuário não encontrado.")

  // Non-admins can only edit their own profile
  if (!isAdmin && targetProfile.email.toLowerCase() !== sessionEmail) {
    throw new Error("Não autorizado.")
  }

  // Non-admins cannot change user type (prevents privilege escalation)
  const type = isAdmin ? data.type : targetProfile.type

  const parsed = userInputSchema.parse({
    name:  data.name.trim(),
    email: data.email.trim().toLowerCase(),
    type,
  })

  // Validate photo path to prevent directory traversal
  const safePhotoPath = data.photoPath !== undefined ? validatePhotoPath(data.photoPath) : undefined

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
}
