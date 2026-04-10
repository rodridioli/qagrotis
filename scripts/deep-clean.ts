
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

  console.log("--- INICIANDO HIGIENIZAÇÃO PROFUNDA ---")

  // 1. Obter todos os sistemas ativos legítimos
  const sistemasAtivos = await prisma.sistema.findMany({
    where: { active: true },
    select: { name: true }
  })
  const nomesAtivos = sistemasAtivos.map(s => s.name)
  console.log(`Sistemas Ativos Identificados: ${nomesAtivos.join(", ") || "Nenhum"}`)

  // 2. Inativar Cenários Órfãos (cujo sistema não está na lista de ativos)
  const cenariosInativados = await prisma.cenario.updateMany({
    where: {
      active: true,
      system: { notIn: nomesAtivos }
    },
    data: { active: false }
  })
  console.log(`Cenários "fantasma" inativados: ${cenariosInativados.count}`)

  // 3. Inativar Módulos Órfãos
  const modulosInativados = await prisma.modulo.updateMany({
    where: {
      active: true,
      sistemaName: { notIn: nomesAtivos }
    },
    data: { active: false }
  })
  console.log(`Módulos "fantasma" inativados: ${modulosInativados.count}`)

  // 4. Inativar Suítes Órfãs
  const suitesInativadas = await prisma.suite.updateMany({
    where: {
      active: true,
      sistema: { notIn: nomesAtivos }
    },
    data: { active: false }
  })
  console.log(`Suítes "fantasma" inativadas: ${suitesInativadas.count}`)

  console.log("--- HIGIENIZAÇÃO CONCLUÍDA ---")
  await prisma.$disconnect()
}

main()
