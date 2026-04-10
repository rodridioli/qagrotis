
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

  console.log("--- INICIANDO MIGRAÇÃO VELOZ (CHUNKS) ---")

  const [sistemas, modulos] = await Promise.all([
    prisma.sistema.findMany({ select: { id: true, name: true } }),
    prisma.modulo.findMany({ select: { id: true, name: true, sistemaName: true } })
  ])

  const sysMap = new Map(sistemas.map(s => [s.name, s.id]))
  const modMap = new Map(modulos.map(m => [`${m.sistemaName}|${m.name}`, m.id]))

  async function processInChunks<T>(items: T[], chunkSize: number, processor: (item: T) => Promise<void>) {
    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize)
      await Promise.all(chunk.map(processor))
      console.log(`Progresso: ${i + chunk.length}/${items.length}`)
    }
  }

  // Cenários
  const cenarios = await prisma.cenario.findMany({ select: { id: true, system: true, module: true } })
  await processInChunks(cenarios, 20, async (c) => {
    const systemId = sysMap.get(c.system)
    const moduleId = modMap.get(`${c.system}|${c.module}`)
    if (systemId || moduleId) {
        await prisma.cenario.update({ where: { id: c.id }, data: { systemId, moduleId } })
    }
  })

  // Suítes
  const suites = await prisma.suite.findMany({ select: { id: true, sistema: true, modulo: true } })
  await processInChunks(suites, 20, async (s) => {
    const sistemaId = sysMap.get(s.sistema)
    const moduloId = modMap.get(`${s.sistema}|${s.modulo}`)
    if (sistemaId || moduloId) {
        await prisma.suite.update({ where: { id: s.id }, data: { sistemaId, moduloId } })
    }
  })

  console.log("--- MIGRAÇÃO CONCLUÍDA ---")
  await prisma.$disconnect()
}

main()
