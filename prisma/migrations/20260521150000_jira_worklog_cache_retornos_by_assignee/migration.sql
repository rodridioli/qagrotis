-- AlterTable
ALTER TABLE "JiraWorklogCache" ADD COLUMN "retornosByAssignee" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "JiraWorklogCache" ADD COLUMN "authorJiraAccountId" TEXT;
