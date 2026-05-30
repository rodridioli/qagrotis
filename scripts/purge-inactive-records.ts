/**
 * purge-inactive-records.ts
 *
 * Remove permanentemente todos os registros com active=false dos cadastros:
 * Cenários, Suítes, Módulos, Sistemas, Credenciais e Clientes.
 *
 * Regras:
 *   - Apenas registros com active=false são removidos.
 *   - Registros com active=true NÃO são tocados.
 *   - A execução é atômica — em caso de falha, nenhum dado é apagado.
 *   - A ordem respeita dependências entre modelos (filhos antes dos pais).
 *
 * Uso:
 *   npx tsx scripts/purge-inactive-records.ts
 */

import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { readFileSync } from "fs"
import { resolve } from "path"

// Carrega .env manualmente (mesmo padrão dos demais scripts)
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
  // ── Contagem prévia ──────────────────────────────────────────────────────
  const [cenarios, suites, modulos, sistemas, credenciais, clientes] =
    await Promise.all([
      prisma.cenario.count({ where: { active: false } }),
      prisma.suite.count({ where: { active: false } }),
      prisma.modulo.count({ where: { active: false } }),
      prisma.sistema.count({ where: { active: false } }),
      prisma.credencial.count({ where: { active: false } }),
      prisma.cliente.count({ where: { active: false } }),
    ])

  const total = cenarios + suites + modulos + sistemas + credenciais + clientes

  console.log("\n📊 Registros inativos encontrados:")
  console.log(`   Cenários:    ${cenarios}`)
  console.log(`   Suítes:      ${suites}`)
  console.log(`   Módulos:     ${modulos}`)
  console.log(`   Sistemas:    ${sistemas}`)
  console.log(`   Credenciais: ${credenciais}`)
  console.log(`   Clientes:    ${clientes}`)
  console.log(`   ─────────────────────`)
  console.log(`   Total:       ${total}`)

  if (total === 0) {
    console.log("\n✅ Nenhum registro inativo encontrado. Nada a remover.")
    return
  }

  console.log("\n🗑️  Executando purga em transação única…")

  // ── Deleção em ordem de dependência (filhos antes dos pais) ──────────────
  // Cenários e Suítes referenciam Sistemas por nome (string), não por FK.
  // Módulos referenciam Sistemas por sistemaId (FK real).
  // Ordem segura: Cenários → Suítes → Módulos → Sistemas → Credenciais → Clientes
  await prisma.$transaction([
    prisma.cenario.deleteMany({ where: { active: false } }),
    prisma.suite.deleteMany({ where: { active: false } }),
    prisma.modulo.deleteMany({ where: { active: false } }),
    prisma.sistema.deleteMany({ where: { active: false } }),
    prisma.credencial.deleteMany({ where: { active: false } }),
    prisma.cliente.deleteMany({ where: { active: false } }),
  ])

  console.log("\n✅ Purga concluída com sucesso!")
  console.log(`   ${cenarios} cenário(s) removido(s)`)
  console.log(`   ${suites} suíte(s) removida(s)`)
  console.log(`   ${modulos} módulo(s) removido(s)`)
  console.log(`   ${sistemas} sistema(s) removido(s)`)
  console.log(`   ${credenciais} credencial(ais) removida(s)`)
  console.log(`   ${clientes} cliente(s) removido(s)`)
  console.log(`   Total: ${total} registro(s) permanentemente excluído(s)\n`)
}

main()
  .catch((err) => {
    console.error("\n❌ Erro durante a purga:", err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
