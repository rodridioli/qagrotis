-- AlterTable: add approver fields to kanban_in_approval_trackers
ALTER TABLE "kanban_in_approval_trackers"
  ADD COLUMN IF NOT EXISTS "approverAccountId"   TEXT,
  ADD COLUMN IF NOT EXISTS "approverDisplayName" TEXT;
