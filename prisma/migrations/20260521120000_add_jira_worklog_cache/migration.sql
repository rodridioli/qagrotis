-- CreateTable
CREATE TABLE "JiraWorklogCache" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "issueKey" TEXT NOT NULL,
    "projectName" TEXT,
    "typeField" TEXT,
    "status" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "timeSpentSeconds" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,

    CONSTRAINT "JiraWorklogCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JiraWorklogSyncMarker" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JiraWorklogSyncMarker_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JiraWorklogCache_userId_issueKey_startedAt_key"
    ON "JiraWorklogCache"("userId", "issueKey", "startedAt");

-- CreateIndex
CREATE INDEX "JiraWorklogCache_userId_year_month_idx"
    ON "JiraWorklogCache"("userId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "JiraWorklogSyncMarker_userId_year_month_key"
    ON "JiraWorklogSyncMarker"("userId", "year", "month");
