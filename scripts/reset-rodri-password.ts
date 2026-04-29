import "dotenv/config"
import { prisma } from "../lib/prisma"
import { hashPassword } from "../lib/db-utils"

const EMAIL = "rodridioli@gmail.com"
const NEW_PASSWORD = "Local#1234"

async function main() {
  const password = hashPassword(NEW_PASSWORD)
  const r = await prisma.createdUser.update({
    where: { email: EMAIL },
    data: { password },
    select: { id: true, email: true },
  })
  console.log(`✔ Senha redefinida para ${r.email} → ${NEW_PASSWORD}`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
