
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
  
  const tokens = await prisma.inviteToken.findMany({
    where: {
      createdAt: { gte: fiveMinutesAgo }
    },
    orderBy: { createdAt: 'desc' }
  })

  if (tokens.length === 0) {
    console.log("❌ NENHUM TOKEN CRIADO: O servidor não recebeu o pedido de esqueci senha nos últimos 5 minutos.")
  } else {
    console.log(`✅ SUCESSO! Encontrei ${tokens.length} tentativa(s) de recuperação no banco.`)
    tokens.forEach(t => {
      console.log(`- E-mail: ${t.email} | Criado em: ${t.createdAt.toLocaleString()}`)
    })
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
