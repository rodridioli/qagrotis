
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { readFileSync } from "fs"
import { resolve } from "path"

async function main() {
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

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
  const prisma = new PrismaClient({ adapter })

  const sysName = "Plataforma AGRO"
  const total = await prisma.cenario.count({ where: { system: sysName } })
  const active = await prisma.cenario.count({ where: { system: sysName, active: true } })
  console.log(`System: "${sysName}"`)
  console.log(`Total Scenarios: ${total}`)
  console.log(`Active Scenarios: ${active}`)

  if (active > 0) {
    const samples = await prisma.cenario.findMany({ 
        where: { system: sysName, active: true },
        take: 5,
        select: { id: true, scenarioName: true, module: true, active: true }
    })
    console.log("Samples of Active Scenarios:")
    console.log(JSON.stringify(samples, null, 2))
  }

  await prisma.$disconnect()
}

main()
