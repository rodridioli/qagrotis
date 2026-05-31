-- Migration: UserJiraCredentials — mudar PK de userId para (userId, jiraUrl)
-- Permite que um mesmo utilizador configure múltiplas instâncias Jira.
-- Os dados existentes são preservados (cada registro mantém seu jiraUrl já cadastrado).

-- 1. Remove a PK atual (única por userId)
ALTER TABLE "UserJiraCredentials" DROP CONSTRAINT "UserJiraCredentials_pkey";

-- 2. Adiciona PK composta (userId, jiraUrl)
ALTER TABLE "UserJiraCredentials" ADD CONSTRAINT "UserJiraCredentials_pkey" PRIMARY KEY ("userId", "jiraUrl");
