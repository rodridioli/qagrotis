-- CreateTable
CREATE TABLE "team_memberships" (
    "id"        TEXT NOT NULL,
    "leaderId"  TEXT NOT NULL,
    "memberId"  TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "team_memberships_memberId_key" ON "team_memberships"("memberId");

-- CreateIndex
CREATE INDEX "team_memberships_leaderId_idx" ON "team_memberships"("leaderId");

-- AddForeignKey
ALTER TABLE "team_memberships" ADD CONSTRAINT "team_memberships_leaderId_fkey"
    FOREIGN KEY ("leaderId") REFERENCES "CreatedUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_memberships" ADD CONSTRAINT "team_memberships_memberId_fkey"
    FOREIGN KEY ("memberId") REFERENCES "CreatedUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
