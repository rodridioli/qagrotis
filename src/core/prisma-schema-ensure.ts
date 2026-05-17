import { prisma } from "@/core/prisma"

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
  __qagrotisEnsuredIndividualProgressaoValorHora?: boolean
  __qagrotisEnsuredClassificacao?: boolean
  __qagrotisEnsuredNotificationTables?: boolean
  __qagrotisEnsuredCenarioSuiteRelations?: boolean
  __qagrotisEnsuredIndividualFerias?: boolean
  __qagrotisEnsuredClienteTable?: boolean
  __qagrotisEnsuredIndividualAusencias?: boolean
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
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "CreatedUser" ADD COLUMN IF NOT EXISTS "photoPath" TEXT`,
    )
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "UserProfile" ADD COLUMN IF NOT EXISTS "photoPath" TEXT`,
    )
    g.__qagrotisEnsuredDataNascimento = true
  } catch (e) {
    console.error("[prisma-schema-ensure] dataNascimento/photoPath columns", e)
  }
}

/**
 * Garante a coluna `classificacao` em `CreatedUser` e `UserProfile`.
 */
export async function ensureUserClassificacaoColumns(): Promise<void> {
  if (g.__qagrotisEnsuredClassificacao) return
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "CreatedUser" ADD COLUMN IF NOT EXISTS "classificacao" TEXT`,
    )
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "UserProfile" ADD COLUMN IF NOT EXISTS "classificacao" TEXT`,
    )
    g.__qagrotisEnsuredClassificacao = true
  } catch (e) {
    console.error("[prisma-schema-ensure] classificacao columns", e)
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

/**
 * Garante a coluna `valorHora` em `IndividualProgressao`.
 */
export async function ensureIndividualProgressaoValorHoraColumn(): Promise<void> {
  if (g.__qagrotisEnsuredIndividualProgressaoValorHora) return
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "IndividualProgressao" ADD COLUMN IF NOT EXISTS "valorHora" INTEGER`,
    )
    g.__qagrotisEnsuredIndividualProgressaoValorHora = true
  } catch (e) {
    console.error("[prisma-schema-ensure] IndividualProgressao.valorHora", e)
  }
}

/**
 * Garante que todas as colunas necessárias para a leitura de perfil existam no Neon.
 * Sincronizado com `lib/prisma-user-selects.ts`.
 */
export async function ensureAllUserProfileColumns(): Promise<void> {
  // Chamamos os ensures existentes que já têm lógica de flag individual
  await ensureUserDataNascimentoColumns()
  await ensureUserClassificacaoColumns()
  await ensureUserWorkScheduleColumns()
  await ensureUserHybridWorkDaysColumns()
  await ensureUserExtendedProfileColumns()

  // accessProfile é um ENUM, precisa de tratamento especial no Neon se não existir.
  try {
    await prisma.$executeRawUnsafe(`
DO $$ BEGIN
    CREATE TYPE "AccessProfile" AS ENUM ('QA', 'UX', 'TW', 'MGR');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "CreatedUser" ADD COLUMN IF NOT EXISTS "accessProfile" "AccessProfile"`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "UserProfile" ADD COLUMN IF NOT EXISTS "accessProfile" "AccessProfile"`)
  } catch (e) {
    console.error("[prisma-schema-ensure] accessProfile enum/column", e)
  }
}

export async function ensureNotificationTables(): Promise<void> {
  if (g.__qagrotisEnsuredNotificationTables) return
  try {
    await prisma.$executeRawUnsafe(`
DO $$ BEGIN
    CREATE TYPE "NotificationType" AS ENUM ('FEEDBACK', 'EVALUATION', 'PROGRESSION', 'ACHIEVEMENT', 'ABSENCE_REQUEST');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
`)
    // If the type already existed without ABSENCE_REQUEST, add it now.
    await prisma.$executeRawUnsafe(`ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ABSENCE_REQUEST'`)
    await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "CreatedUser"(id) ON DELETE CASCADE ON UPDATE CASCADE
);
`)
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "Notification_userId_idx" ON "Notification"("userId")`,
    )
    await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS "UserBadge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserBadge_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "UserBadge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "CreatedUser"(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserBadge_userId_badgeId_key" UNIQUE ("userId", "badgeId")
);
`)
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "UserBadge_userId_idx" ON "UserBadge"("userId")`,
    )
    g.__qagrotisEnsuredNotificationTables = true
  } catch (e) {
    console.error("[prisma-schema-ensure] Notification/UserBadge tables", e)
  }
}

/**
 * Garante que a tabela Cliente existe e tem todas as colunas esperadas.
 * Idempotente — seguro chamar em cada request.
 */
export async function ensureClienteTable(): Promise<void> {
  if (g.__qagrotisEnsuredClienteTable) return
  try {
    await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS "Cliente" (
    "id"           TEXT NOT NULL,
    "nomeFantasia" TEXT NOT NULL,
    "razaoSocial"  TEXT,
    "cpfCnpj"      TEXT,
    "active"       BOOLEAN NOT NULL DEFAULT true,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
)`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "Cliente" ADD COLUMN IF NOT EXISTS "razaoSocial" TEXT`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "Cliente" ADD COLUMN IF NOT EXISTS "cpfCnpj" TEXT`)
    g.__qagrotisEnsuredClienteTable = true
  } catch (e) {
    console.error("[prisma-schema-ensure] Cliente table", e)
  }
}

/**
 * Garante colunas FK de relação em Cenario e Suite.
 * Adicionadas ao schema sem migration formal — idempotente via IF NOT EXISTS.
 */
export async function ensureCenarioSuiteRelationColumns(): Promise<void> {
  if (g.__qagrotisEnsuredCenarioSuiteRelations) return
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Cenario" ADD COLUMN IF NOT EXISTS "systemId" TEXT`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "Cenario" ADD COLUMN IF NOT EXISTS "moduleId" TEXT`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "Cenario" ADD COLUMN IF NOT EXISTS "credencialId" TEXT`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "Cenario" ADD COLUMN IF NOT EXISTS "createdBy" TEXT`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "Suite" ADD COLUMN IF NOT EXISTS "sistemaId" TEXT`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "Suite" ADD COLUMN IF NOT EXISTS "moduloId" TEXT`)
    g.__qagrotisEnsuredCenarioSuiteRelations = true
  } catch (e) {
    console.error("[prisma-schema-ensure] Cenario/Suite relation columns", e)
  }
}

/**
 * Garante tabela de férias individuais (Individual / MGR).
 * DDL idempotente — cria a tabela se não existir (Vercel/Neon sem `migrate deploy`).
 */
export async function ensureIndividualFeriasTable(): Promise<void> {
  if (g.__qagrotisEnsuredIndividualFerias) return
  try {
    await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS "IndividualFerias" (
    "id" TEXT NOT NULL,
    "evaluatedUserId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "codigo" INTEGER NOT NULL,
    "inicio" TIMESTAMP(3) NOT NULL,
    "dias" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IndividualFerias_pkey" PRIMARY KEY ("id")
);`)
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IndividualFerias_evaluatedUserId_codigo_key" ON "IndividualFerias"("evaluatedUserId", "codigo")`
    )
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "IndividualFerias_evaluatedUserId_idx" ON "IndividualFerias"("evaluatedUserId")`
    )
    g.__qagrotisEnsuredIndividualFerias = true
  } catch (e) {
    console.error("[prisma-schema-ensure] IndividualFerias", e)
    throw e
  }
}

/**
 * Garante tabela de ausências individuais (Individual / MGR).
 * DDL idempotente — cria enums, tabela e índices se não existirem.
 */
export async function ensureIndividualAusenciasTable(): Promise<void> {
  if (g.__qagrotisEnsuredIndividualAusencias) return
  // Garante que NotificationType existe com ABSENCE_REQUEST antes de referenciar o tipo.
  await ensureNotificationTables()
  try {
    await prisma.$executeRawUnsafe(`
DO $$ BEGIN
    CREATE TYPE "AusenciaTipo" AS ENUM ('FALTA', 'BANCO_HORAS', 'ATESTADO', 'OUTRO');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
`)
    await prisma.$executeRawUnsafe(`
DO $$ BEGIN
    CREATE TYPE "AusenciaSituacao" AS ENUM ('PENDENTE', 'APROVADA', 'RECUSADA');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
`)
    await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS "IndividualAusencias" (
    "id" TEXT NOT NULL,
    "evaluatedUserId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "codigo" INTEGER NOT NULL,
    "tipo" "AusenciaTipo" NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "diaInteiro" BOOLEAN NOT NULL,
    "horaInicio" TEXT,
    "horaFim" TEXT,
    "justificativa" TEXT NOT NULL,
    "situacao" "AusenciaSituacao" NOT NULL DEFAULT 'PENDENTE',
    "motivoRecusa" TEXT,
    "aprovadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IndividualAusencias_pkey" PRIMARY KEY ("id")
);
`)
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IndividualAusencias_evaluatedUserId_codigo_key" ON "IndividualAusencias"("evaluatedUserId", "codigo")`
    )
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "IndividualAusencias_evaluatedUserId_idx" ON "IndividualAusencias"("evaluatedUserId")`
    )
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "IndividualAusencias_situacao_idx" ON "IndividualAusencias"("situacao")`
    )
    g.__qagrotisEnsuredIndividualAusencias = true
  } catch (e) {
    console.error("[prisma-schema-ensure] IndividualAusencias", e)
  }
}
