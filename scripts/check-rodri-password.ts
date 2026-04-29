import "dotenv/config"
import { prisma } from "../lib/prisma"
import { verifyPassword } from "../lib/db-utils"

async function main() {
  const u = await prisma.createdUser.findFirst({
    where: { email: "rodridioli@gmail.com" },
    select: { id: true, email: true, password: true },
  })
  console.log("user:", u?.id, u?.email)
  console.log("hash prefix:", u?.password?.slice(0, 40))
  console.log("hash length:", u?.password?.length)
  console.log("verify 'Local#1234' →", verifyPassword("Local#1234", u?.password ?? ""))
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
