import { PrismaClient } from "@prisma/client"
import { MOCK_USERS } from "../lib/qagrotis-constants"

const prisma = new PrismaClient()

async function main() {
  console.log("Seeding QaUser table...")

  for (const u of MOCK_USERS) {
    await prisma.qaUser.upsert({
      where: { id: u.id },
      update: {},
      create: {
        id: u.id,
        name: u.name,
        email: u.email,
        type: u.type,
        active: u.active,
      },
    })
  }

  console.log(`Seeded ${MOCK_USERS.length} users.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
