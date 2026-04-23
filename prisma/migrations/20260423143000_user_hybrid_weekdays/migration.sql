-- Dias da semana em formato híbrido (JSON array de ids estáveis, ex.: ["seg","qua"])
ALTER TABLE "CreatedUser" ADD COLUMN "diasTrabalhoHibrido" JSONB;
ALTER TABLE "UserProfile" ADD COLUMN "diasTrabalhoHibrido" JSONB;
