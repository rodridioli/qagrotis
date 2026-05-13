import { prisma } from "@/core/prisma"
import { env } from "@/core/env"
import { decryptField, encryptField } from "@/core/db-utils"

const SINGLETON_ID = "default"

export async function getClockworkApiTokenFromDb(): Promise<string | null> {
  try {
    const row = await prisma.clockworkIntegration.findUnique({
      where: { id: SINGLETON_ID },
      select: { apiToken: true },
    })
    if (!row?.apiToken?.trim()) return null
    return decryptField(row.apiToken).trim() || null
  } catch (e) {
    if (process.env.NODE_ENV !== "production") console.error("[clockwork-credentials-db] getClockworkApiTokenFromDb:", e)
    return null
  }
}

/** Token para chamadas Clockwork: BD primeiro, depois CLOCKWORK_API_TOKEN no ambiente. */
export async function getClockworkApiTokenResolved(): Promise<string> {
  const fromDb = await getClockworkApiTokenFromDb()
  if (fromDb) return fromDb
  return env.CLOCKWORK_API_TOKEN.trim()
}

export async function isClockworkTokenStoredInDb(): Promise<boolean> {
  const t = await getClockworkApiTokenFromDb()
  return !!t
}

/**
 * Grava ou atualiza o token. Se `apiToken` vier vazio, mantém o existente na BD;
 * falha com MISSING_TOKEN se não houver token guardado nem novo.
 */
export async function upsertClockworkApiToken(actingUserId: string, apiToken: string | null | undefined): Promise<void> {
  const incoming = apiToken?.trim() ?? ""
  const existing = await prisma.clockworkIntegration.findUnique({
    where: { id: SINGLETON_ID },
    select: { apiToken: true },
  })
  const existingPlain = existing?.apiToken ? decryptField(existing.apiToken).trim() : ""

  if (!incoming && !existingPlain) {
    throw new Error("MISSING_TOKEN")
  }

  const tokenToEncrypt = incoming || existingPlain

  await prisma.clockworkIntegration.upsert({
    where: { id: SINGLETON_ID },
    create: {
      id: SINGLETON_ID,
      apiToken: encryptField(tokenToEncrypt),
      updatedByUserId: actingUserId,
    },
    update: {
      ...(incoming ? { apiToken: encryptField(incoming) } : {}),
      updatedByUserId: actingUserId,
    },
  })
}

export async function deleteClockworkIntegration(): Promise<void> {
  await prisma.clockworkIntegration.deleteMany({ where: { id: SINGLETON_ID } })
}
