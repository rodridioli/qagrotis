-- AddIndex: KanbanInApprovalTracker.userId
-- Supports queries that filter trackers by userId (e.g. fetching all in-approval items per user)
CREATE INDEX IF NOT EXISTS "kanban_in_approval_trackers_userId_idx"
  ON "kanban_in_approval_trackers"("userId");
