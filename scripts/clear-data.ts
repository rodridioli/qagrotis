/**
 * clear-data.ts
 *
 * Remove TODOS os registros de sistemas, módulos, clientes, suítes e cenários.
 * Preserva usuários (QaUser) que estejam ativos.
 * Executa em transação única — em caso de falha, nenhum dado é apagado.
 *
 * Uso:
 *   npx tsx scripts/clear-data.ts
 */

import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { readFileSync } from "fs"
import { resolve } from "path"

// Carrega .env manualmente (mesmo padrão do seed.ts)
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
  // Contagem antes para exibir resumo
  const [sistemas, modulos, clientes, suites, cenarios, usersAtivos, usersInativos] =
    await Promise.all([
      prisma.sistema.count(),
      prisma.modulo.count(),
      prisma.cliente.count(),
      prisma.suite.count(),
      prisma.cenario.count(),
      prisma.qaUser.count({ where: { active: true } }),
      prisma.qaUser.count({ where: { active: false } }),
    ])

  console.log("\n📊 Estado atual do banco:")
  console.log(`   Sistemas:  ${sistemas}`)
  console.log(`   Módulos:   ${modulos}`)
  console.log(`   Clientes:  ${clientes}`)
  console.log(`   Suítes:    ${suites}`)
  console.log(`   Cenários:  ${cenarios}`)
  console.log(`   Usuários ativos (serão preservados): ${usersAtivos}`)
  console.log(`   Usuários inativos (serão removidos): ${usersInativos}`)

  const total = sistemas + modulos + clientes + suites + cenarios + usersInativos
  if (total === 0) {
    console.log("\n✅ Banco já está limpo. Nada a remover.")
    return
  }

  console.log("\n🗑️  Executando limpeza em transação única…")

  await prisma.$transaction([
    prisma.cenario.deleteMany({}),
    prisma.suite.deleteMany({}),
    prisma.modulo.deleteMany({}),
    prisma.sistema.deleteMany({}),
    prisma.cliente.deleteMany({}),
    prisma.qaUser.deleteMany({ where: { active: false } }),
  ])

  console.log("\n✅ Limpeza concluída com sucesso:")
  console.log(`   Sistemas removidos:       ${sistemas}`)
  console.log(`   Módulos removidos:        ${modulos}`)
  console.log(`   Clientes removidos:       ${clientes}`)
  console.log(`   Suítes removidas:         ${suites}`)
  console.log(`   Cenários removidos:       ${cenarios}`)
  console.log(`   Usuários inativos removidos: ${usersInativos}`)
  console.log(`   Usuários ativos preservados: ${usersAtivos}`)
}

main()
  .catch((err) => {
    console.error("\n❌ Erro durante a limpeza. Nenhum dado foi apagado (rollback).")
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
