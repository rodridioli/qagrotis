-- AlterTable
ALTER TABLE "EquipeChapterRating" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- One rating per user per chapter
CREATE UNIQUE INDEX IF NOT EXISTS "EquipeChapterRating_chapterId_userId_key" ON "EquipeChapterRating"("chapterId", "userId");
