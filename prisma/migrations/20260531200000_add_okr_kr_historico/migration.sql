-- Migration: adiciona tabela okr_kr_historico para rastrear cada atualização
-- de valorAtual de um Key Result, incluindo quem atualizou e quando.

CREATE TABLE "okr_kr_historico" (
    "id"              TEXT NOT NULL,
    "keyResultId"     TEXT NOT NULL,
    "valorAnterior"   DOUBLE PRECISION NOT NULL,
    "valorNovo"       DOUBLE PRECISION NOT NULL,
    "updatedByUserId" TEXT NOT NULL,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "okr_kr_historico_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "okr_kr_historico_keyResultId_idx" ON "okr_kr_historico"("keyResultId");

ALTER TABLE "okr_kr_historico"
    ADD CONSTRAINT "okr_kr_historico_keyResultId_fkey"
    FOREIGN KEY ("keyResultId")
    REFERENCES "okr_key_results"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
