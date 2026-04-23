import { prisma } from "@/lib/prisma"

const g = globalThis as unknown as {
  __qagrotisEnsuredDataNascimento?: boolean
  __qagrotisEnsuredWorkSchedule?: boolean
  __qagrotisEnsuredHybridWeekdays?: boolean
  __qagrotisEnsuredEquipeChapters?: boolean
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

/**
 * Garante `diasTrabalhoHibrido` (JSONB) em CreatedUser e UserProfile.
 */
export async function ensureUserHybridWorkDaysColumns(): Promise<void> {
  if (g.__qagrotisEnsuredHybridWeekdays) return
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "CreatedUser" ADD COLUMN IF NOT EXISTS "diasTrabalhoHibrido" JSONB`,
    )
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "UserProfile" ADD COLUMN IF NOT EXISTS "diasTrabalhoHibrido" JSONB`,
    )
    g.__qagrotisEnsuredHybridWeekdays = true
  } catch (e) {
    console.error("[prisma-schema-ensure] hybrid weekdays columns", e)
  }
}

/**
 * Garante tabelas de Chapters da Equipe (Neon/Vercel sem `migrate deploy` ou baseline P3005).
 * DDL idempotente — espelha `prisma/migrations/20260424120000_equipe_chapters/migration.sql`.
 */
export async function ensureEquipeChapterTables(): Promise<void> {
  if (g.__qagrotisEnsuredEquipeChapters) return
  try {
    await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS "EquipeChapter" (
    "id" TEXT NOT NULL,
    "tema" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "hyperlink" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EquipeChapter_pkey" PRIMARY KEY ("id")
);
`)
    await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS "EquipeChapterAuthor" (
    "chapterId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "EquipeChapterAuthor_pkey" PRIMARY KEY ("chapterId","userId"),
    CONSTRAINT "EquipeChapterAuthor_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "EquipeChapter" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
`)
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "EquipeChapter_data_idx" ON "EquipeChapter"("data")`,
    )
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "EquipeChapterAuthor_userId_idx" ON "EquipeChapterAuthor"("userId")`,
    )
    g.__qagrotisEnsuredEquipeChapters = true
  } catch (e) {
    console.error("[prisma-schema-ensure] EquipeChapter tables", e)
  }
}
