-- CreateEnum
CREATE TYPE "OkrPeriodo" AS ENUM ('Q1', 'Q2', 'Q3', 'Q4');

-- CreateEnum
CREATE TYPE "OkrSituacao" AS ENUM ('ATIVO', 'ENCERRADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "OkrObjetivoSituacao" AS ENUM ('ATIVO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "OkrKrSituacao" AS ENUM ('ATIVO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "OkrUnidade" AS ENUM ('PERCENTUAL', 'REAL', 'UNIDADES', 'HORAS', 'DIAS', 'PERSONALIZADA');

-- CreateEnum
CREATE TYPE "OkrIniciativaStatus" AS ENUM ('PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "OkrEquipe" AS ENUM ('QA', 'UX', 'TW', 'GESTAO');

-- CreateTable
CREATE TABLE "okrs" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "periodo" "OkrPeriodo" NOT NULL,
    "situacao" "OkrSituacao" NOT NULL DEFAULT 'ATIVO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "okrs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "okr_objetivos" (
    "id" TEXT NOT NULL,
    "okrId" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "situacao" "OkrObjetivoSituacao" NOT NULL DEFAULT 'ATIVO',
    "motivoCancelamento" TEXT,
    "percentualConcluido" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "okr_objetivos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "okr_objetivo_equipes" (
    "objetivoId" TEXT NOT NULL,
    "equipe" "OkrEquipe" NOT NULL,

    CONSTRAINT "okr_objetivo_equipes_pkey" PRIMARY KEY ("objetivoId","equipe")
);

-- CreateTable
CREATE TABLE "okr_key_results" (
    "id" TEXT NOT NULL,
    "objetivoId" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "unidade" "OkrUnidade" NOT NULL DEFAULT 'PERCENTUAL',
    "unidadePersonalizada" TEXT,
    "valorInicial" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "valorAtual" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "meta" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "situacao" "OkrKrSituacao" NOT NULL DEFAULT 'ATIVO',
    "motivoCancelamento" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "okr_key_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "okr_kr_responsaveis" (
    "keyResultId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "okr_kr_responsaveis_pkey" PRIMARY KEY ("keyResultId","userId")
);

-- CreateTable
CREATE TABLE "okr_kr_evolucao" (
    "id" TEXT NOT NULL,
    "keyResultId" TEXT NOT NULL,
    "mes" INTEGER NOT NULL,
    "ano" INTEGER NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "okr_kr_evolucao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "okr_iniciativas" (
    "id" TEXT NOT NULL,
    "keyResultId" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "status" "OkrIniciativaStatus" NOT NULL DEFAULT 'PENDENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "okr_iniciativas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "okr_iniciativa_responsaveis" (
    "iniciativaId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "okr_iniciativa_responsaveis_pkey" PRIMARY KEY ("iniciativaId","userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "okrs_codigo_key" ON "okrs"("codigo");

-- CreateIndex
CREATE INDEX "okrs_ano_idx" ON "okrs"("ano");

-- CreateIndex
CREATE INDEX "okrs_situacao_idx" ON "okrs"("situacao");

-- CreateIndex
CREATE INDEX "okr_objetivos_okrId_idx" ON "okr_objetivos"("okrId");

-- CreateIndex
CREATE INDEX "okr_key_results_objetivoId_idx" ON "okr_key_results"("objetivoId");

-- CreateIndex
CREATE INDEX "okr_kr_responsaveis_userId_idx" ON "okr_kr_responsaveis"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "okr_kr_evolucao_keyResultId_mes_ano_key" ON "okr_kr_evolucao"("keyResultId", "mes", "ano");

-- CreateIndex
CREATE INDEX "okr_kr_evolucao_keyResultId_idx" ON "okr_kr_evolucao"("keyResultId");

-- CreateIndex
CREATE INDEX "okr_iniciativas_keyResultId_idx" ON "okr_iniciativas"("keyResultId");

-- CreateIndex
CREATE INDEX "okr_iniciativa_responsaveis_userId_idx" ON "okr_iniciativa_responsaveis"("userId");

-- AddForeignKey
ALTER TABLE "okr_objetivos" ADD CONSTRAINT "okr_objetivos_okrId_fkey" FOREIGN KEY ("okrId") REFERENCES "okrs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "okr_objetivo_equipes" ADD CONSTRAINT "okr_objetivo_equipes_objetivoId_fkey" FOREIGN KEY ("objetivoId") REFERENCES "okr_objetivos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "okr_key_results" ADD CONSTRAINT "okr_key_results_objetivoId_fkey" FOREIGN KEY ("objetivoId") REFERENCES "okr_objetivos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "okr_kr_responsaveis" ADD CONSTRAINT "okr_kr_responsaveis_keyResultId_fkey" FOREIGN KEY ("keyResultId") REFERENCES "okr_key_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "okr_kr_evolucao" ADD CONSTRAINT "okr_kr_evolucao_keyResultId_fkey" FOREIGN KEY ("keyResultId") REFERENCES "okr_key_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "okr_iniciativas" ADD CONSTRAINT "okr_iniciativas_keyResultId_fkey" FOREIGN KEY ("keyResultId") REFERENCES "okr_key_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "okr_iniciativa_responsaveis" ADD CONSTRAINT "okr_iniciativa_responsaveis_iniciativaId_fkey" FOREIGN KEY ("iniciativaId") REFERENCES "okr_iniciativas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
