"use server"

import { promises as fs } from "fs"
import path from "path"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { MOCK_USERS } from "@/lib/qagrotis-constants"
import { PROTOTYPE_USERS } from "@/lib/prototype-users"

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

// ── Storage helpers ─────────────────────────────────────────────────────────

const DATA_DIR = path.join(process.cwd(), "data")
const INACTIVE_FILE = path.join(DATA_DIR, "inactive-users.json")
const PROFILES_FILE = path.join(DATA_DIR, "user-profiles.json")
const CREATED_FILE = path.join(DATA_DIR, "created-users.json")

interface CreatedUser {
  id: string
  name: string
  email: string
  type: string
  photoPath: string | null
  password: string
  createdAt?: number
}

async function readCreatedUsers(): Promise<CreatedUser[]> {
  try {
    const content = await fs.readFile(CREATED_FILE, "utf-8")
    return JSON.parse(content) as CreatedUser[]
  } catch {
    return []
  }
}

async function writeCreatedUsers(users: CreatedUser[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true })
  await fs.writeFile(CREATED_FILE, JSON.stringify(users, null, 2), "utf-8")
}

async function readInactiveIds(): Promise<Set<string>> {
  try {
    const content = await fs.readFile(INACTIVE_FILE, "utf-8")
    return new Set(JSON.parse(content) as string[])
  } catch {
    return new Set()
  }
}

async function writeInactiveIds(ids: Set<string>): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true })
  await fs.writeFile(INACTIVE_FILE, JSON.stringify([...ids]), "utf-8")
}

async function readProfiles(): Promise<Record<string, QaUserProfile>> {
  try {
    const content = await fs.readFile(PROFILES_FILE, "utf-8")
    return JSON.parse(content) as Record<string, QaUserProfile>
  } catch {
    return {}
  }
}

async function writeProfiles(profiles: Record<string, QaUserProfile>): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true })
  await fs.writeFile(PROFILES_FILE, JSON.stringify(profiles, null, 2), "utf-8")
}

// ── Public actions ─────────────────────────────────────────────────────────

export async function getQaUsers(): Promise<QaUserRecord[]> {
  const [inactiveIds, profiles, createdUsers] = await Promise.all([
    readInactiveIds(),
    readProfiles(),
    readCreatedUsers(),
  ])

  const mockRecords: QaUserRecord[] = MOCK_USERS.map((u) => {
    const p = profiles[u.id]
    return {
      id: u.id,
      name: p?.name ?? u.name,
      email: p?.email ?? u.email,
      type: p?.type ?? u.type,
      active: inactiveIds.has(u.id) ? false : u.active,
      photoPath: p?.photoPath ?? null,
    }
  })

  const createdRecords: QaUserRecord[] = createdUsers.map((u) => {
    const p = profiles[u.id]
    return {
      id: u.id,
      name: p?.name ?? u.name,
      email: p?.email ?? u.email,
      type: p?.type ?? u.type,
      active: !inactiveIds.has(u.id),
      photoPath: p?.photoPath ?? u.photoPath,
      createdAt: u.createdAt,
    }
  })

  return [...mockRecords, ...createdRecords]
}

export async function getQaUserProfile(id: string): Promise<QaUserProfile | null> {
  const result = idSchema.safeParse(id)
  if (!result.success) return null

  const [profiles, createdUsers] = await Promise.all([readProfiles(), readCreatedUsers()])
  const mockUser = MOCK_USERS.find((u) => u.id === id)
  const createdUser = createdUsers.find((u) => u.id === id)
  const base = mockUser ?? createdUser
  if (!base) return null
  const saved = profiles[id]
  return {
    name: saved?.name ?? base.name,
    email: saved?.email ?? base.email,
    type: saved?.type ?? base.type,
    photoPath: saved?.photoPath ?? createdUser?.photoPath ?? null,
  }
}

export async function inativarQaUsers(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  idsArraySchema.parse(ids)

  const inactiveIds = await readInactiveIds()
  for (const id of ids) inactiveIds.add(id)
  await writeInactiveIds(inactiveIds)
  revalidatePath("/configuracoes/usuarios")
}

export async function criarQaUser(data: {
  name: string
  email: string
  type: string
  password: string
}): Promise<void> {
  const parsed = userInputSchema.parse({
    name: data.name.trim(),
    email: data.email.trim().toLowerCase(),
    type: data.type,
  })

  // Password: min 6, max 128 chars
  const password = z.string().min(6, "Senha mínima de 6 caracteres").max(128).parse(data.password)

  const users = await readCreatedUsers()

  // Prevent duplicate email
  const allMockEmails = MOCK_USERS.map((u) => u.email.toLowerCase())
  const allCreatedEmails = users.map((u) => u.email.toLowerCase())
  if (allMockEmails.includes(parsed.email) || allCreatedEmails.includes(parsed.email)) {
    throw new Error("E-mail já cadastrado.")
  }

  const allMockIds = MOCK_USERS.map((u) => u.id)
  const allCreatedIds = users.map((u) => u.id)
  const nums = [...allMockIds, ...allCreatedIds]
    .map((id) => parseInt(id.replace("U-", ""), 10))
    .filter((n) => !isNaN(n))
  const nextNum = nums.length > 0 ? Math.max(...nums) + 1 : 1
  const id = `U-${String(nextNum).padStart(2, "0")}`

  users.push({ id, ...parsed, photoPath: null, password, createdAt: Date.now() })
  await writeCreatedUsers(users)
  revalidatePath("/configuracoes/usuarios")
}

export async function validateLogin(
  email: string,
  password: string
): Promise<{ ok: true } | { ok: false; reason: "invalid_credentials" | "inactive" }> {
  const normalizedEmail = email.trim().toLowerCase()
  const [inactiveIds, createdUsers, profiles] = await Promise.all([
    readInactiveIds(),
    readCreatedUsers(),
    readProfiles(),
  ])

  const createdUser = createdUsers.find((u) => u.email.toLowerCase() === normalizedEmail)
  if (createdUser) {
    if (createdUser.password !== password) return { ok: false, reason: "invalid_credentials" }
    if (inactiveIds.has(createdUser.id)) return { ok: false, reason: "inactive" }
    return { ok: true }
  }

  const mockUser = MOCK_USERS.find((u) => u.email.toLowerCase() === normalizedEmail)
  if (mockUser) {
    const expectedPassword = PROTOTYPE_USERS[normalizedEmail] ?? "admin"
    if (password !== expectedPassword) return { ok: false, reason: "invalid_credentials" }
    const profile = profiles[mockUser.id]
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
  idSchema.parse(id)
  const parsed = userInputSchema.parse({
    name: data.name.trim(),
    email: data.email.trim().toLowerCase(),
    type: data.type,
  })

  const profiles = await readProfiles()
  const current = profiles[id]

  profiles[id] = {
    ...parsed,
    photoPath: data.photoPath !== undefined ? data.photoPath : (current?.photoPath ?? null),
  }

  await writeProfiles(profiles)
  revalidatePath("/configuracoes/usuarios")
  revalidatePath(`/configuracoes/usuarios/${id}`)
  revalidatePath(`/configuracoes/usuarios/${id}/editar`)
}
