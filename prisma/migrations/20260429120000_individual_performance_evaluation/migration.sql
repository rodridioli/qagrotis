-- CreateEnum
CREATE TYPE "IndividualPerformanceEvaluationStatus" AS ENUM ('RASCUNHO', 'CONCLUIDA');

-- CreateTable
CREATE TABLE "IndividualPerformanceEvaluation" (
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

-- CreateIndex
CREATE UNIQUE INDEX "IndividualPerformanceEvaluation_evaluatedUserId_codigo_key" ON "IndividualPerformanceEvaluation"("evaluatedUserId", "codigo");

-- CreateIndex
CREATE INDEX "IndividualPerformanceEvaluation_evaluatedUserId_idx" ON "IndividualPerformanceEvaluation"("evaluatedUserId");
