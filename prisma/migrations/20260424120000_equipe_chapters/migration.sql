-- CreateTable
CREATE TABLE "EquipeChapter" (
    "id" TEXT NOT NULL,
    "tema" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "hyperlink" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EquipeChapter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipeChapterAuthor" (
    "chapterId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "EquipeChapterAuthor_pkey" PRIMARY KEY ("chapterId","userId"),
    CONSTRAINT "EquipeChapterAuthor_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "EquipeChapter" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "EquipeChapter_data_idx" ON "EquipeChapter"("data");

-- CreateIndex
CREATE INDEX "EquipeChapterAuthor_userId_idx" ON "EquipeChapterAuthor"("userId");
