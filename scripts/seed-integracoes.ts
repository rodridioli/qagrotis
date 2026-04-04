/**
 * One-time script: seeds OpenRouter integrations into the database.
 * Run: npx tsx scripts/seed-integracoes.ts
 */
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

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter, log: ["error"] })

const API_KEY = process.env.OPENROUTER_API_KEY ?? ""

const integracoes = [
  {
    id: "INT-01",
    descricao: "Gemini 2.0 Flash (visão, gratuito)",
    provider: "openrouter",
    model: "google/gemini-2.0-flash-lite:free",
    apiKey: API_KEY,
    active: true,
  },
  {
    id: "INT-02",
    descricao: "Llama 3.2 Vision (visão, gratuito)",
    provider: "openrouter",
    model: "meta-llama/llama-3.2-11b-vision-instruct:free",
    apiKey: API_KEY,
    active: true,
  },
]

async function main() {
  if (!API_KEY) {
    console.error("OPENROUTER_API_KEY não definida. Passe via env: OPENROUTER_API_KEY=sk-or-... npx tsx scripts/seed-integracoes.ts")
    process.exit(1)
  }

  // Get existing max ID to avoid conflicts
  const existing = await prisma.integracao.findMany({ select: { id: true } })
  const existingIds = new Set(existing.map(r => r.id))

  for (const item of integracoes) {
    if (existingIds.has(item.id)) {
      // Update apiKey if already exists
      await prisma.integracao.update({ where: { id: item.id }, data: { apiKey: item.apiKey } })
      console.log(`Updated ${item.id} — ${item.model}`)
    } else {
      await prisma.integracao.create({ data: item })
      console.log(`Created ${item.id} — ${item.model}`)
    }
  }
  console.log("Done.")
}

main().catch(console.error).finally(() => prisma.$disconnect())
