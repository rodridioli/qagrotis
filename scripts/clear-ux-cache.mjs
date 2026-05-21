import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const year = 2026
  const months = [1, 2, 3]

  const deleted = await prisma.jiraWorklogCache.deleteMany({
    where: { year, month: { in: months } },
  })

  const markers = await prisma.jiraWorklogSyncMarker.deleteMany({
    where: { year, month: { in: months } },
  })

  console.log(`Removidos ${deleted.count} registros de JiraWorklogCache (Jan-Mar ${year})`)
  console.log(`Removidos ${markers.count} registros de JiraWorklogSyncMarker (Jan-Mar ${year})`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
