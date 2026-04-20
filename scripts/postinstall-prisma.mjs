#!/usr/bin/env node
/**
 * Pós-instalação: tenta gerar o Prisma Client sem derrubar npm install
 * se a rede bloquear o download dos engines (binaries.prisma.sh).
 */
import { spawnSync } from "node:child_process"

const r = spawnSync("npx", ["prisma", "generate"], {
  cwd: process.cwd(),
  stdio: "inherit",
  shell: true,
  env: process.env,
})

if (r.status !== 0) {
  console.warn(`
[postinstall] prisma generate não concluiu (rede/proxy/firewall).
Instalação do npm terminou mesmo assim. Antes de dev/build, rode:
  npx prisma generate
`)
}

process.exit(0)
