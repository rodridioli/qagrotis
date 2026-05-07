import { prisma } from "@/lib/prisma"

const g = globalThis as unknown as {
  __qagrotisEnsuredDataNascimento?: boolean
  __qagrotisEnsuredWorkSchedule?: boolean
  __qagrotisEnsuredHybridWeekdays?: boolean
  __qagrotisEnsuredEquipeChapters?: boolean
  __qagrotisEnsuredExtendedProfile?: boolean
  __qagrotisEnsuredIndividualPerformanceEval?: boolean
  __qagrotisEnsuredIndividualFeedback?: boolean
  __qagrotisEnsuredIndividualFeedbackPeriodo?: boolean
  __qagrotisEnsuredIndividualProgressao?: boolean
  __qagrotisEnsuredIndividualProgressaoCargo?: boolean
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
    await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS "EquipeChapterRating" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stars" INTEGER NOT NULL,
    "comment" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EquipeChapterRating_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "EquipeChapterRating_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "EquipeChapter" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
`)
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "EquipeChapterRating" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
    )
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "EquipeChapterRating_chapterId_userId_key" ON "EquipeChapterRating"("chapterId", "userId")`,
    )
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "EquipeChapterRating_chapterId_idx" ON "EquipeChapterRating"("chapterId")`,
    )
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "EquipeChapterRating_chapterId_createdAt_idx" ON "EquipeChapterRating"("chapterId", "createdAt")`,
    )
    g.__qagrotisEnsuredEquipeChapters = true
  } catch (e) {
    console.error("[prisma-schema-ensure] EquipeChapter tables", e)
  }
}

/**
 * Garante colunas de endereço, contato, formação e carreira em CreatedUser e UserProfile.
 */
export async function ensureUserExtendedProfileColumns(): Promise<void> {
  if (g.__qagrotisEnsuredExtendedProfile) return
  const cols = [
    ["cep", "TEXT"],
    ["address", "TEXT"],
    ["addressNumber", "TEXT"],
    ["neighborhood", "TEXT"],
    ["country", "TEXT"],
    ["state", "TEXT"],
    ["city", "TEXT"],
    ["phone", "TEXT"],
    ["emergencyContact", "TEXT"],
    ["instagram", "TEXT"],
    ["linkedin", "TEXT"],
    ["education", "JSONB"],
    ["courses", "JSONB"],
    ["languages", "JSONB"],
    ["certifications", "JSONB"],
    ["careerHistory", "JSONB"],
  ]
  try {
    for (const [name, type] of cols) {
      await prisma.$executeRawUnsafe(`ALTER TABLE "CreatedUser" ADD COLUMN IF NOT EXISTS "${name}" ${type}`)
      await prisma.$executeRawUnsafe(`ALTER TABLE "UserProfile" ADD COLUMN IF NOT EXISTS "${name}" ${type}`)
    }
    g.__qagrotisEnsuredExtendedProfile = true
  } catch (e) {
    console.error("[prisma-schema-ensure] extended profile columns", e)
  }
}

/**
 * Garante tabela e enum de avaliações de desempenho (Individual / MGR).
 * DDL idempotente — espelha `prisma/migrations/20260429120000_individual_performance_evaluation/migration.sql`.
 */
export async function ensureIndividualPerformanceEvaluationTable(): Promise<void> {
  if (g.__qagrotisEnsuredIndividualPerformanceEval) return
  try {
    await prisma.$executeRawUnsafe(`
DO $$ BEGIN
    CREATE TYPE "IndividualPerformanceEvaluationStatus" AS ENUM ('RASCUNHO', 'CONCLUIDA');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
`)
    await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS "IndividualPerformanceEvaluation" (
    "id" TEXT NOT NULL,
    "evaluatedUserId" TEXT NOT NULL,
    "evaluatorUserId" TEXT NOT NULL,
    "codigo" INTEGER NOT NULL,
    "status" "IndividualPerformanceEvaluationStatus" NOT NULL DEFAULT 'RASCUNHO',
    "selections" JSONB NOT NULL DEFAULT '{}',
    "pontuacaoPercent" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IndividualPerformanceEvaluation_pkey" PRIMARY KEY ("id")
);
`)
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IndividualPerformanceEvaluation_evaluatedUserId_codigo_key" ON "IndividualPerformanceEvaluation"("evaluatedUserId", "codigo")`,
    )
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "IndividualPerformanceEvaluation_evaluatedUserId_idx" ON "IndividualPerformanceEvaluation"("evaluatedUserId")`,
    )
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "IndividualPerformanceEvaluation" ADD COLUMN IF NOT EXISTS "periodo" TEXT NOT NULL DEFAULT 'T1_TRIMESTRE'`,
    )
    g.__qagrotisEnsuredIndividualPerformanceEval = true
  } catch (e) {
    console.error("[prisma-schema-ensure] IndividualPerformanceEvaluation", e)
  }
}

/**
 * Garante tabela e enum de feedbacks individuais (Individual / MGR).
 * DDL idempotente — cria a tabela se não existir no banco (Vercel / Neon sem migrate deploy).
 */
export async function ensureIndividualFeedbackTable(): Promise<void> {
  if (g.__qagrotisEnsuredIndividualFeedback) return
  try {
    await prisma.$executeRawUnsafe(`
DO $$ BEGIN
    CREATE TYPE "IndividualFeedbackStatus" AS ENUM ('RASCUNHO', 'CONCLUIDA');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
`)
    await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS "IndividualFeedback" (
    "id" TEXT NOT NULL,
    "evaluatedUserId" TEXT NOT NULL,
    "evaluatorUserId" TEXT NOT NULL,
    "codigo" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "status" "IndividualFeedbackStatus" NOT NULL DEFAULT 'RASCUNHO',
    "campos" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IndividualFeedback_pkey" PRIMARY KEY ("id")
);
`)
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IndividualFeedback_evaluatedUserId_codigo_key" ON "IndividualFeedback"("evaluatedUserId", "codigo")`,
    )
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "IndividualFeedback_evaluatedUserId_idx" ON "IndividualFeedback"("evaluatedUserId")`,
    )
    g.__qagrotisEnsuredIndividualFeedback = true
  } catch (e) {
    console.error("[prisma-schema-ensure] IndividualFeedback", e)
    throw e
  }
}

/**
 * Garante a coluna `periodo` em `IndividualFeedback`.
 * Flag separada para rodar mesmo quando `ensureIndividualFeedbackTable` já foi cacheado.
 */
export async function ensureIndividualFeedbackPeriodoColumn(): Promise<void> {
  if (g.__qagrotisEnsuredIndividualFeedbackPeriodo) return
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "IndividualFeedback" ADD COLUMN IF NOT EXISTS "periodo" TEXT NOT NULL DEFAULT 'T1_TRIMESTRE'`,
    )
    g.__qagrotisEnsuredIndividualFeedbackPeriodo = true
  } catch (e) {
    console.error("[prisma-schema-ensure] IndividualFeedback.periodo", e)
  }
}

/**
 * Garante tabela de progressões salariais individuais.
 * DDL idempotente — cria a tabela se não existir (Vercel/Neon sem `migrate deploy`).
 */
export async function ensureIndividualProgressaoTable(): Promise<void> {
  if (g.__qagrotisEnsuredIndividualProgressao) return
  try {
    await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS "IndividualProgressao" (
    "id" TEXT NOT NULL,
    "evaluatedUserId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "codigo" INTEGER NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "tipo" TEXT NOT NULL,
    "regime" TEXT NOT NULL,
    "valor" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IndividualProgressao_pkey" PRIMARY KEY ("id")
);
`)
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IndividualProgressao_evaluatedUserId_codigo_key" ON "IndividualProgressao"("evaluatedUserId", "codigo")`,
    )
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "IndividualProgressao_evaluatedUserId_idx" ON "IndividualProgressao"("evaluatedUserId")`,
    )
    g.__qagrotisEnsuredIndividualProgressao = true
  } catch (e) {
    console.error("[prisma-schema-ensure] IndividualProgressao", e)
    throw e
  }
}

/**
 * Garante a coluna `cargo` em `IndividualProgressao`.
 * Flag separada para rodar mesmo quando `ensureIndividualProgressaoTable` já foi cacheado.
 */
export async function ensureIndividualProgressaoCargoColumn(): Promise<void> {
  if (g.__qagrotisEnsuredIndividualProgressaoCargo) return
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "IndividualProgressao" ADD COLUMN IF NOT EXISTS "cargo" TEXT`,
    )
    g.__qagrotisEnsuredIndividualProgressaoCargo = true
  } catch (e) {
    console.error("[prisma-schema-ensure] IndividualProgressao.cargo", e)
  }
}
