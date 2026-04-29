-- CreateEnum
CREATE TYPE "AccessProfile" AS ENUM ('QA', 'UX', 'TW', 'MGR');

-- AlterTable
ALTER TABLE "CreatedUser" ADD COLUMN "accessProfile" "AccessProfile";

-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN "accessProfile" "AccessProfile";

-- Backfill: usuários existentes recebem QA por padrão
UPDATE "CreatedUser" SET "accessProfile" = 'QA' WHERE "accessProfile" IS NULL;
UPDATE "UserProfile" SET "accessProfile" = 'QA' WHERE "accessProfile" IS NULL;
