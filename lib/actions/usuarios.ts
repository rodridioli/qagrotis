"use server"

import { promises as fs } from "fs"
import path from "path"
import { revalidatePath } from "next/cache"
import { MOCK_USERS } from "@/lib/qagrotis-constants"

export interface QaUserRecord {
  id: string
  name: string
  email: string
  type: string
  active: boolean
  photoPath: string | null
}

export interface QaUserProfile {
  name: string
  email: string
  type: string
  photoPath: string | null
}

// ── Storage helpers ────────────────────────────────────────────────────────

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
    }
  })

  return [...mockRecords, ...createdRecords]
}

export async function getQaUserProfile(id: string): Promise<QaUserProfile | null> {
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
  const users = await readCreatedUsers()
  const allMockIds = MOCK_USERS.map((u) => u.id)
  const allCreatedIds = users.map((u) => u.id)
  const allIds = [...allMockIds, ...allCreatedIds]

  // Generate next sequential ID
  const nums = allIds
    .map((id) => parseInt(id.replace("U-", ""), 10))
    .filter((n) => !isNaN(n))
  const nextNum = nums.length > 0 ? Math.max(...nums) + 1 : 1
  const id = `U-${String(nextNum).padStart(2, "0")}`

  users.push({ id, name: data.name.trim(), email: data.email.trim(), type: data.type, photoPath: null })
  await writeCreatedUsers(users)
  revalidatePath("/configuracoes/usuarios")
}

export async function atualizarQaUser(
  id: string,
  data: { name: string; email: string; type: string; photoPath?: string | null }
): Promise<void> {
  const profiles = await readProfiles()
  const current = profiles[id]

  profiles[id] = {
    name: data.name.trim(),
    email: data.email.trim(),
    type: data.type,
    photoPath: data.photoPath !== undefined ? data.photoPath : (current?.photoPath ?? null),
  }

  await writeProfiles(profiles)
  revalidatePath("/configuracoes/usuarios")
  revalidatePath(`/configuracoes/usuarios/${id}`)
  revalidatePath(`/configuracoes/usuarios/${id}/editar`)
}
