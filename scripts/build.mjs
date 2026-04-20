#!/usr/bin/env node
/**
 * Build de produção: prisma generate (se necessário) + next build.
 *
 * Rede bloqueando binaries.prisma.sh (comum em corporativo):
 *   - Defina HTTPS_PROXY / HTTP_PROXY se usar proxy
 *   - Ou rode uma vez em rede aberta: npx prisma generate
 *   - Com client já gerado em node_modules/.prisma: SKIP_PRISMA_GENERATE=1 npm run build
 */
import { spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import { join } from "node:path"

const root = process.cwd()
const prismaClientDir = join(root, "node_modules", ".prisma", "client")

function hasGeneratedClient() {
  return (
    existsSync(join(prismaClientDir, "index.js")) ||
    existsSync(join(prismaClientDir, "default.js"))
  )
}

const skipGen =
  process.env.SKIP_PRISMA_GENERATE === "1" && hasGeneratedClient()

if (skipGen) {
  console.info("[build] SKIP_PRISMA_GENERATE=1 e client Prisma encontrado — pulando prisma generate.")
} else {
  const gen = spawnSync("npx", ["prisma", "generate"], {
    cwd: root,
    stdio: "inherit",
    shell: true,
    env: process.env,
  })
  if (gen.status !== 0) {
    console.error(`
----------------------------------------------------------------------
prisma generate falhou (muitas vezes: firewall/proxy bloqueia
https://binaries.prisma.sh).

Tente:
  1) Outra rede (ex.: hotspot) e:  npx prisma generate
  2) Proxy corporativo no PowerShell:
       $env:HTTPS_PROXY="http://usuario:senha@proxy:porta"
       $env:HTTP_PROXY="http://usuario:senha@proxy:porta"
       npx prisma generate
  3) Certificado SSL: $env:NODE_EXTRA_CA_CERTS="C:\\caminho\\corp.pem"

Se o client já existir (outro PC / backup de node_modules/.prisma):
  SKIP_PRISMA_GENERATE=1 npm run build
----------------------------------------------------------------------
`)
    process.exit(gen.status ?? 1)
  }
}

// Aplicar migrações no Postgres de produção (Vercel/CI com DATABASE_URL).
// Sem isso, o schema do client fica à frente do banco e findMany() quebra (coluna inexistente).
const dbUrl =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL ||
  process.env.PRISMA_DATABASE_URL ||
  ""
const skipMigrate = process.env.SKIP_PRISMA_MIGRATE === "1"
const hasRealDb =
  dbUrl.length > 12 && !/placeholder/i.test(dbUrl) && dbUrl.startsWith("postgres")

if (skipMigrate) {
  console.info("[build] SKIP_PRISMA_MIGRATE=1 — pulando prisma migrate deploy.")
} else if (hasRealDb) {
  console.info("[build] prisma migrate deploy (aplicar migrações pendentes no banco)")
  const migrate = spawnSync("npx", ["prisma", "migrate", "deploy"], {
    cwd: root,
    stdio: "inherit",
    shell: true,
    env: process.env,
  })
  if (migrate.status !== 0) {
    console.error(`
----------------------------------------------------------------------
prisma migrate deploy falhou. O banco precisa estar alinhado ao schema.
Verifique DATABASE_URL na Vercel e os logs acima.

Para build local sem DB: SKIP_PRISMA_MIGRATE=1 npm run build
----------------------------------------------------------------------
`)
    process.exit(migrate.status ?? 1)
  }
} else {
  console.info("[build] DATABASE_URL não definida ou placeholder — pulando prisma migrate deploy.")
}

const build = spawnSync("npx", ["next", "build"], {
  cwd: root,
  stdio: "inherit",
  shell: true,
  env: process.env,
})
process.exit(build.status ?? 0)
