-- CreateTable: kanban_timer_sessions
-- Tracks active and paused time-tracking sessions for kanban cards.
-- startedAt = NULL  → timer paused (card left "Em andamento").
-- accumulatedSeconds → total seconds from all previously closed sessions (posted to Clockwork).

CREATE TABLE "kanban_timer_sessions" (
    "issueKey"           TEXT         NOT NULL,
    "userId"             TEXT         NOT NULL,
    "startedAt"          TIMESTAMP(3),
    "accumulatedSeconds" INTEGER      NOT NULL DEFAULT 0,
    "summary"            TEXT,
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kanban_timer_sessions_pkey" PRIMARY KEY ("issueKey")
);

-- CreateIndex
CREATE INDEX "kanban_timer_sessions_userId_idx" ON "kanban_timer_sessions"("userId");
