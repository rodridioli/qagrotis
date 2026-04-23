-- CreateTable
CREATE TABLE "UserJiraCredentials" (
    "userId" TEXT NOT NULL,
    "jiraUrl" TEXT NOT NULL,
    "jiraEmail" TEXT NOT NULL,
    "apiToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserJiraCredentials_pkey" PRIMARY KEY ("userId")
);
