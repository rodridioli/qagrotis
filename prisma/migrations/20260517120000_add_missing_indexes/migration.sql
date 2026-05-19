-- Add missing indexes for performance on frequently filtered columns

-- Suite: active + sistema (common filter in dashboard, equipe, and gerador queries)
CREATE INDEX IF NOT EXISTS "Suite_active_sistema_idx" ON "Suite"("active", "sistema");

-- Cliente: active (common filter in all listing queries)
CREATE INDEX IF NOT EXISTS "Cliente_active_idx" ON "Cliente"("active");

-- Integracao: active (common filter in gerador/assistente queries and fallback logic)
CREATE INDEX IF NOT EXISTS "Integracao_active_idx" ON "Integracao"("active");

-- Modulo: active + sistemaName (used in criarCenario/atualizarCenario lookups)
CREATE INDEX IF NOT EXISTS "Modulo_active_sistemaName_idx" ON "Modulo"("active", "sistemaName");

-- Modulo: sistemaId (FK relationship queries)
CREATE INDEX IF NOT EXISTS "Modulo_sistemaId_idx" ON "Modulo"("sistemaId");

-- InviteToken: userId (lookup when re-sending invites)
CREATE INDEX IF NOT EXISTS "InviteToken_userId_idx" ON "InviteToken"("userId");

-- InviteToken: expiresAt (cleanup of expired tokens)
CREATE INDEX IF NOT EXISTS "InviteToken_expiresAt_idx" ON "InviteToken"("expiresAt");
