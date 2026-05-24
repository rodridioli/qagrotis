-- CreateTable: persistent Jira accountId cache per user
-- Survives force-sync (which only wipes JiraWorklogCache) so inactive Jira
-- accounts can still be resolved for worklog queries after deactivation.

CREATE TABLE "JiraAccountIdCache" (
    "userId"     TEXT NOT NULL,
    "accountId"  TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3) NOT NULL,
    "resolvedBy" TEXT,

    CONSTRAINT "JiraAccountIdCache_pkey" PRIMARY KEY ("userId")
);

-- Backfill: populate from existing JiraWorklogCache entries (most recent per user)
INSERT INTO "JiraAccountIdCache" ("userId", "accountId", "resolvedAt", "resolvedBy")
SELECT DISTINCT ON ("userId")
    "userId",
    "authorJiraAccountId",
    NOW(),
    'db-worklog-cache'
FROM "JiraWorklogCache"
WHERE "authorJiraAccountId" IS NOT NULL
  AND "authorJiraAccountId" <> ''
ORDER BY "userId", "startedAt" DESC
ON CONFLICT ("userId") DO NOTHING;
