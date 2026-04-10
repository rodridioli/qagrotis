
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const users = await prisma.createdUser.findMany({
    select: { email: true }
  })
  console.log("Usuários existentes no banco:")
  console.log(users.map(u => u.email).join("\n"))
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
