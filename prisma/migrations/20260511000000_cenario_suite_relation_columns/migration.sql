-- Garante colunas FK de relação em Cenario e Suite adicionadas sem migration formal.
-- ADD COLUMN IF NOT EXISTS é idempotente — seguro em DBs que já têm as colunas.

ALTER TABLE "Cenario" ADD COLUMN IF NOT EXISTS "systemId" TEXT;
ALTER TABLE "Cenario" ADD COLUMN IF NOT EXISTS "moduleId" TEXT;
ALTER TABLE "Cenario" ADD COLUMN IF NOT EXISTS "credencialId" TEXT;
ALTER TABLE "Cenario" ADD COLUMN IF NOT EXISTS "createdBy" TEXT;

ALTER TABLE "Suite" ADD COLUMN IF NOT EXISTS "sistemaId" TEXT;
ALTER TABLE "Suite" ADD COLUMN IF NOT EXISTS "moduloId" TEXT;
