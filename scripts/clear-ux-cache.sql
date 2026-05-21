DELETE FROM "JiraWorklogCache" WHERE year = 2026 AND month IN (1, 2, 3);
DELETE FROM "JiraWorklogSyncMarker" WHERE year = 2026 AND month IN (1, 2, 3);
