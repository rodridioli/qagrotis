-- Add updatedAt to models that were missing it.
-- Uses IF NOT EXISTS / coalesce pattern so it is safe to re-run (idempotent).
-- Existing rows receive updatedAt = createdAt (best available approximation).

-- Cliente
ALTER TABLE "Cliente"
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

UPDATE "Cliente"
  SET "updatedAt" = "createdAt"
  WHERE "updatedAt" = '1970-01-01 00:00:00';

-- Sistema
ALTER TABLE "Sistema"
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

UPDATE "Sistema"
  SET "updatedAt" = "createdAt"
  WHERE "updatedAt" = '1970-01-01 00:00:00';

-- Modulo
ALTER TABLE "Modulo"
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

UPDATE "Modulo"
  SET "updatedAt" = "createdAt"
  WHERE "updatedAt" = '1970-01-01 00:00:00';

-- Cenario: fix nullable createdAt → NOT NULL, then add updatedAt
UPDATE "Cenario"
  SET "createdAt" = NOW()
  WHERE "createdAt" IS NULL;

ALTER TABLE "Cenario"
  ALTER COLUMN "createdAt" SET NOT NULL,
  ALTER COLUMN "createdAt" SET DEFAULT NOW();

ALTER TABLE "Cenario"
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

UPDATE "Cenario"
  SET "updatedAt" = "createdAt"
  WHERE "updatedAt" = '1970-01-01 00:00:00';

-- Suite
ALTER TABLE "Suite"
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

UPDATE "Suite"
  SET "updatedAt" = "createdAt"
  WHERE "updatedAt" = '1970-01-01 00:00:00';

-- Credencial
ALTER TABLE "Credencial"
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

UPDATE "Credencial"
  SET "updatedAt" = "createdAt"
  WHERE "updatedAt" = '1970-01-01 00:00:00';

-- Integracao
ALTER TABLE "Integracao"
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

UPDATE "Integracao"
  SET "updatedAt" = "createdAt"
  WHERE "updatedAt" = '1970-01-01 00:00:00';
