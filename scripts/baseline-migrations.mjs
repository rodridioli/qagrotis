#!/usr/bin/env node
/**
 * Baseline de migrations num banco existente (resolve P3005).
 *
 * Quando rodar:
 *   - O banco já tem as tabelas (ex.: criado por `prisma db push` antes).
 *   - `prisma migrate deploy` retorna P3005 porque não existe histórico em `_prisma_migrations`.
 *
 * O que faz:
 *   - Lista todas as migrations em prisma/migrations
 *   - Marca cada uma como já aplicada (`prisma migrate resolve --applied <name>`)
 *
 * Como usar (local apontando para a DATABASE_URL de produção):
 *   DATABASE_URL="postgres://..." node scripts/baseline-migrations.mjs
 *
 * Após rodar uma vez, o próximo deploy não verá mais P3005.
 */
import { spawnSync } from "node:child_process"
import { readdirSync, statSync } from "node:fs"
import { join } from "node:path"

const root = process.cwd()
const migrationsDir = join(root, "prisma", "migrations")

if (!process.env.DATABASE_URL) {
  console.error("[baseline] DATABASE_URL não definida. Aborte.")
  process.exit(1)
}

const entries = readdirSync(migrationsDir)
  .filter((name) => statSync(join(migrationsDir, name)).isDirectory())
  .filter((name) => /^\d{14}_/.test(name))
  .sort()

if (entries.length === 0) {
  console.error("[baseline] Nenhuma migration encontrada em prisma/migrations.")
  process.exit(1)
}

console.info(`[baseline] Marcando ${entries.length} migrations como aplicadas:`)
for (const name of entries) {
  console.info(`  - ${name}`)
  const r = spawnSync(
    "npx",
    ["prisma", "migrate", "resolve", "--applied", name],
    { cwd: root, stdio: "inherit", shell: true, env: process.env }
  )
  if (r.status !== 0) {
    console.warn(`[baseline] Falha em ${name} (talvez já aplicada). Continuando…`)
  }
}

console.info("[baseline] Concluído. Rode 'npx prisma migrate status' para conferir.")
