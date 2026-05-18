import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { readFileSync } from "fs"
import { resolve } from "path"

try {
  const lines = readFileSync(resolve(process.cwd(), ".env"), "utf-8").split("\n")
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "")
    if (key && !(key in process.env)) process.env[key] = val
  }
} catch { /* ignore */ }

async function main() {
  const cliUrl = process.argv.find((a) => a.startsWith("--url="))?.slice(6)
  const connectionString = cliUrl ?? process.env.DATABASE_URL
  if (!connectionString) { console.error("❌ DATABASE_URL não configurado."); process.exit(1) }

  const adapter = new PrismaPg({ connectionString })
  const prisma = new PrismaClient({ adapter })

  try {
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "ChapterRedemption" (
        "id"         TEXT NOT NULL,
        "userId"     TEXT NOT NULL,
        "prizeId"    TEXT NOT NULL,
        "prizeLabel" TEXT NOT NULL,
        "costPoints" INTEGER NOT NULL,
        "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "ChapterRedemption_pkey" PRIMARY KEY ("id")
      )
    `
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "ChapterRedemption_userId_idx" ON "ChapterRedemption"("userId")
    `
    console.log("✅ Tabela ChapterRedemption criada (ou já existia).")
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => { console.error("❌", e); process.exit(1) })
