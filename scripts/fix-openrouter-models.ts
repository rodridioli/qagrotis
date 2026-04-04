/**
 * Fix OpenRouter model IDs — replaces deprecated experimental models with stable ones.
 * Run: npx tsx scripts/fix-openrouter-models.ts
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

// Map deprecated model → replacement
const MODEL_FIXES: Record<string, { model: string; descricao: string }> = {
  "google/gemini-2.0-flash-exp:free": {
    model: "google/gemini-2.0-flash-lite:free",
    descricao: "Gemini 2.0 Flash Lite (visão, gratuito)",
  },
}

async function main() {
  const all = await prisma.integracao.findMany({ where: { provider: "openrouter" } })
  console.log(`Found ${all.length} OpenRouter integration(s):`)
  for (const item of all) {
    console.log(`  ${item.id} — ${item.model} — active:${item.active}`)
    const fix = MODEL_FIXES[item.model]
    if (fix) {
      await prisma.integracao.update({
        where: { id: item.id },
        data: { model: fix.model, descricao: fix.descricao },
      })
      console.log(`  ✔ Updated ${item.id}: ${item.model} → ${fix.model}`)
    }
  }
  console.log("Done.")
}

main().catch(console.error).finally(() => prisma.$disconnect())
