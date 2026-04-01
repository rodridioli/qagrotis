import { defineConfig } from "prisma/config"
import { readFileSync } from "fs"
import { resolve } from "path"

// Prisma 7+ does not auto-load .env before evaluating prisma.config.ts —
// manually load it here so CLI commands work without exporting env vars.
try {
  const envPath = resolve(process.cwd(), ".env")
  const lines = readFileSync(envPath, "utf-8").split("\n")
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eqIdx = trimmed.indexOf("=")
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "")
    if (key && !(key in process.env)) process.env[key] = val
  }
} catch { /* .env not present — rely on real env vars (e.g. in Vercel) */ }

// During `prisma generate` (Vercel build), the URL is not needed — skip the check.
// At runtime and for db push/seed, DATABASE_URL must be set.
const databaseUrl = process.env.DATABASE_URL ?? "postgresql://placeholder:placeholder@localhost/placeholder"

export default defineConfig({
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: databaseUrl,
  },
})
