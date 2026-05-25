-- AlterTable: add Broken Test reporter stats columns to JiraWorklogSyncMarker
-- jirasBroken     = count of BT issues created by reporter in the month (via JQL, independent of worklogs)
-- cenariosErroSum = sum of qtdCenariosQA of those BT issues (Tipo B for "Cenários com Erro" in QA Dashboard)
ALTER TABLE "JiraWorklogSyncMarker" ADD COLUMN "jirasBroken" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "JiraWorklogSyncMarker" ADD COLUMN "cenariosErroSum" INTEGER NOT NULL DEFAULT 0;
