-- AlterTable
ALTER TABLE "IndividualPerformanceEvaluation" ADD COLUMN IF NOT EXISTS "periodo" TEXT NOT NULL DEFAULT 'T1_TRIMESTRE';
