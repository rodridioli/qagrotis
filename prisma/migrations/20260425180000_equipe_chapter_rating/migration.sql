-- CreateTable
CREATE TABLE "EquipeChapterRating" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stars" INTEGER NOT NULL,
    "comment" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EquipeChapterRating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EquipeChapterRating_chapterId_idx" ON "EquipeChapterRating"("chapterId");

-- CreateIndex
CREATE INDEX "EquipeChapterRating_chapterId_createdAt_idx" ON "EquipeChapterRating"("chapterId", "createdAt");

-- AddForeignKey
ALTER TABLE "EquipeChapterRating" ADD CONSTRAINT "EquipeChapterRating_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "EquipeChapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
