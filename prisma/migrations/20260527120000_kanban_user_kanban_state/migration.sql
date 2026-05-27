-- AlterTable: add cardType column to kanban_assignments (default "demanda")
ALTER TABLE "kanban_assignments" ADD COLUMN "cardType" TEXT NOT NULL DEFAULT 'demanda';

-- CreateTable: per-user card column state (Demandas only)
CREATE TABLE "kanban_user_card_states" (
    "issueKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "column" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kanban_user_card_states_pkey" PRIMARY KEY ("issueKey")
);

-- CreateIndex
CREATE INDEX "kanban_user_card_states_userId_idx" ON "kanban_user_card_states"("userId");

-- CreateTable: in-approval 24h tracker
CREATE TABLE "kanban_in_approval_trackers" (
    "issueKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cardType" TEXT NOT NULL,
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastCommentAt" TIMESTAMP(3),

    CONSTRAINT "kanban_in_approval_trackers_pkey" PRIMARY KEY ("issueKey")
);
