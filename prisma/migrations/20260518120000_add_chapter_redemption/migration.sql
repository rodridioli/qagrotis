-- CreateTable
CREATE TABLE IF NOT EXISTS "ChapterRedemption" (
    "id"         TEXT NOT NULL,
    "userId"     TEXT NOT NULL,
    "prizeId"    TEXT NOT NULL,
    "prizeLabel" TEXT NOT NULL,
    "costPoints" INTEGER NOT NULL,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChapterRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ChapterRedemption_userId_idx" ON "ChapterRedemption"("userId");
