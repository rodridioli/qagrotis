import { prisma } from "@/lib/prisma"

const g = globalThis as unknown as {
  __qagrotisEnsuredDataNascimento?: boolean
  __qagrotisEnsuredWorkSchedule?: boolean
}

/**
 * Garante as colunas `dataNascimento` em `CreatedUser` e `UserProfile`.
 *
 * Quando `prisma migrate deploy` não corre no build (ex.: URL do Postgres só em runtime
 * na Vercel), o client Prisma continua a esperar estas colunas e o SELECT falha.
 * `ADD COLUMN IF NOT EXISTS` é idempotente e corrige o schema na primeira chamada.
 */
export async function ensureUserDataNascimentoColumns(): Promise<void> {
  if (g.__qagrotisEnsuredDataNascimento) return
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "CreatedUser" ADD COLUMN IF NOT EXISTS "dataNascimento" TIMESTAMP(3)`,
    )
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "UserProfile" ADD COLUMN IF NOT EXISTS "dataNascimento" TIMESTAMP(3)`,
    )
    g.__qagrotisEnsuredDataNascimento = true
  } catch (e) {
    console.error("[prisma-schema-ensure] dataNascimento columns", e)
  }
}

/**
 * Garante horário entrada/saída e formato de trabalho em CreatedUser e UserProfile.
 */
export async function ensureUserWorkScheduleColumns(): Promise<void> {
  if (g.__qagrotisEnsuredWorkSchedule) return
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "CreatedUser" ADD COLUMN IF NOT EXISTS "horarioEntrada" TEXT`,
    )
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "CreatedUser" ADD COLUMN IF NOT EXISTS "horarioSaida" TEXT`,
    )
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "CreatedUser" ADD COLUMN IF NOT EXISTS "formatoTrabalho" TEXT`,
    )
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "UserProfile" ADD COLUMN IF NOT EXISTS "horarioEntrada" TEXT`,
    )
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "UserProfile" ADD COLUMN IF NOT EXISTS "horarioSaida" TEXT`,
    )
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "UserProfile" ADD COLUMN IF NOT EXISTS "formatoTrabalho" TEXT`,
    )
    g.__qagrotisEnsuredWorkSchedule = true
  } catch (e) {
    console.error("[prisma-schema-ensure] work schedule columns", e)
  }
}
