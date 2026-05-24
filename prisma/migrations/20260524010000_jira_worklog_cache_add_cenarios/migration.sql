-- AlterTable: add qtdCenariosQA and qtdCenariosErro columns to JiraWorklogCache
ALTER TABLE "JiraWorklogCache" ADD COLUMN "qtdCenariosQA" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "JiraWorklogCache" ADD COLUMN "qtdCenariosErro" INTEGER NOT NULL DEFAULT 0;
