/**
 * clear-ux-jira-cache.ts
 *
 * Apaga o cache de worklogs Jira de todos os membros UX para o ano corrente,
 * forçando re-sync completo (com tags) na próxima abertura do painel UX.
 *
 * Uso:
 *   npx tsx scripts/clear-ux-jira-cache.ts
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

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter, log: ["error"] })

async function main() {
  const year = new Date().getFullYear()

  const members = await prisma.createdUser.findMany({
    where: { accessProfile: "UX" },
    select: { id: true, name: true, email: true },
  })

  if (members.length === 0) {
    console.log("Nenhum membro UX ativo encontrado.")
    return
  }

  console.log(`Membros UX encontrados (${members.length}):`)
  for (const m of members) console.log(`  - ${m.name} (${m.email})`)

  const userIds = members.map((m) => m.id)

  const [deletedCache, deletedMarkers] = await Promise.all([
    prisma.jiraWorklogCache.deleteMany({ where: { userId: { in: userIds }, year } }),
    prisma.jiraWorklogSyncMarker.deleteMany({ where: { userId: { in: userIds }, year } }),
  ])

  console.log(`\nCache ${year} apagado:`)
  console.log(`  - JiraWorklogCache: ${deletedCache.count} registros removidos`)
  console.log(`  - JiraWorklogSyncMarker: ${deletedMarkers.count} marcadores removidos`)
  console.log("\nPronto! Abra o painel UX e clique no botão de sincronizar para recarregar os dados com as tags.")
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
