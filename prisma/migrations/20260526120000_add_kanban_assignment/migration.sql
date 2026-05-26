-- CreateTable
CREATE TABLE "kanban_assignments" (
    "issueKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kanban_assignments_pkey" PRIMARY KEY ("issueKey")
);

-- CreateIndex
CREATE INDEX "kanban_assignments_userId_idx" ON "kanban_assignments"("userId");
