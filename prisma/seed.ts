/**
 * Database seed — reads existing JSON files and inserts all data into Postgres.
 * Safe to run multiple times (upsert / skipDuplicates throughout).
 */

import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { promises as fs } from "fs"
import path from "path"
import { readFileSync } from "fs"
import { resolve } from "path"

// Load .env manually (Prisma CLI doesn't auto-inject env for tsx seed scripts)
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
const DATA = path.join(process.cwd(), "data")

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(path.join(DATA, file), "utf-8")
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

async function main() {
  // ── Sistemas ────────────────────────────────────────────────────────────────
  // Use upsert so that placeholder sistemas marked active:false in the JSON
  // are correctly inactivated even if they were previously seeded as active:true.
  const sistemas = await readJson<Array<{
    id: string; name: string; description: string | null; active: boolean; createdAt?: number
  }>>("sistemas.json", [])

  if (sistemas.length) {
    for (const s of sistemas) {
      await prisma.sistema.upsert({
        where: { id: s.id },
        // Only enforce inactivation — never force-activate seed placeholders
        update: s.active ? {} : { active: false },
        create: {
          id:          s.id,
          name:        s.name,
          description: s.description ?? null,
          active:      s.active ?? true,
          createdAt:   s.createdAt ? new Date(s.createdAt) : new Date(),
        },
      })
    }
    console.log(`✓ sistemas      (${sistemas.length})`)
  }

  // ── Módulos ─────────────────────────────────────────────────────────────────
  // Same upsert strategy: inactivate placeholder modulos if the JSON says active:false.
  const modulos = await readJson<Array<{
    id: string; name: string; description: string | null;
    sistemaId: string; sistemaName: string; active: boolean; createdAt?: number
  }>>("modulos.json", [])

  if (modulos.length) {
    for (const m of modulos) {
      await prisma.modulo.upsert({
        where: { id: m.id },
        update: m.active ? {} : { active: false },
        create: {
          id:          m.id,
          name:        m.name,
          description: m.description ?? null,
          sistemaId:   m.sistemaId,
          sistemaName: m.sistemaName,
          active:      m.active ?? true,
          createdAt:   m.createdAt ? new Date(m.createdAt) : new Date(),
        },
      })
    }
    console.log(`✓ modulos        (${modulos.length})`)
  }

  // ── Clientes ────────────────────────────────────────────────────────────────
  const clientes = await readJson<Array<{
    id: string; nomeFantasia: string; razaoSocial: string | null;
    cpfCnpj: string | null; active: boolean; createdAt?: number
  }>>("clientes.json", [])

  if (clientes.length) {
    await prisma.cliente.createMany({
      data: clientes.map((c) => ({
        id:           c.id,
        nomeFantasia: c.nomeFantasia,
        razaoSocial:  c.razaoSocial ?? null,
        cpfCnpj:      c.cpfCnpj ?? null,
        active:       c.active ?? true,
        createdAt:    c.createdAt ? new Date(c.createdAt) : new Date(),
      })),
      skipDuplicates: true,
    })
    console.log(`✓ clientes       (${clientes.length})`)
  }

  // ── Cenários ────────────────────────────────────────────────────────────────
  const cenarios = await readJson<Array<{
    id: string; scenarioName: string; system: string; module: string; client?: string;
    execucoes?: number; erros?: number; suites?: number; tipo: string; active: boolean;
    createdAt?: number; risco?: string; regraDeNegocio?: string; descricao?: string;
    caminhoTela?: string; preCondicoes?: string; bdd?: string; resultadoEsperado?: string;
    urlScript?: string; usuarioTeste?: string; senhaTeste?: string; senhaFalsa?: string;
    steps?: unknown; deps?: string[]; createdBy?: string;
  }>>("cenarios.json", [])

  if (cenarios.length) {
    await prisma.cenario.createMany({
      data: cenarios.map((c) => ({
        id:                c.id,
        scenarioName:      c.scenarioName,
        system:            c.system,
        module:            c.module,
        client:            c.client ?? "",
        execucoes:         c.execucoes ?? 0,
        erros:             c.erros ?? 0,
        suites:            c.suites ?? 0,
        tipo:              c.tipo,
        active:            c.active ?? true,
        createdAt:         c.createdAt ? new Date(c.createdAt) : null,
        risco:             c.risco ?? null,
        regraDeNegocio:    c.regraDeNegocio ?? null,
        descricao:         c.descricao ?? null,
        caminhoTela:       c.caminhoTela ?? null,
        preCondicoes:      c.preCondicoes ?? null,
        bdd:               c.bdd ?? null,
        resultadoEsperado: c.resultadoEsperado ?? null,
        urlScript:         c.urlScript ?? null,
        usuarioTeste:      c.usuarioTeste ?? null,
        senhaTeste:        c.senhaTeste ?? null,
        senhaFalsa:        c.senhaFalsa ?? null,
        steps:             (c.steps as object) ?? [],
        deps:              c.deps ?? [],
        createdBy:         c.createdBy ?? null,
      })),
      skipDuplicates: true,
    })
    console.log(`✓ cenarios       (${cenarios.length})`)
  }

  // ── Suítes ──────────────────────────────────────────────────────────────────
  const suites = await readJson<Array<{
    id: string; suiteName: string; versao: string; sistema: string; modulo: string;
    cliente?: string; tipo?: string; objetivo?: string | null; active: boolean;
    createdAt: number; cenarios?: unknown; historico?: unknown;
  }>>("suites.json", [])

  if (suites.length) {
    await prisma.suite.createMany({
      data: suites.map((s) => ({
        id:        s.id,
        suiteName: s.suiteName,
        versao:    s.versao,
        sistema:   s.sistema,
        modulo:    s.modulo,
        cliente:   s.cliente ?? "",
        tipo:      s.tipo ?? "Sprint",
        objetivo:  s.objetivo ?? null,
        active:    s.active ?? true,
        createdAt: s.createdAt ? new Date(s.createdAt) : new Date(),
        cenarios:  (s.cenarios as object) ?? [],
        historico: (s.historico as object) ?? [],
      })),
      skipDuplicates: true,
    })
    console.log(`✓ suites         (${suites.length})`)
  }

  // ── Created users ───────────────────────────────────────────────────────────
  const createdUsers = await readJson<Array<{
    id: string; name: string; email: string; type?: string;
    photoPath?: string | null; password?: string; createdAt?: number
  }>>("created-users.json", [])

  if (createdUsers.length) {
    await prisma.createdUser.createMany({
      data: createdUsers.map((u) => ({
        id:        u.id,
        name:      u.name,
        email:     u.email.toLowerCase(),
        type:      u.type ?? "Padrão",
        photoPath: u.photoPath ?? null,
        password:  u.password ?? "",
        createdAt: u.createdAt ? new Date(u.createdAt) : new Date(),
      })),
      skipDuplicates: true,
    })
    console.log(`✓ created users  (${createdUsers.length})`)
  }

  // ── Inactive users ──────────────────────────────────────────────────────────
  const inactiveIds = await readJson<string[]>("inactive-users.json", [])

  if (inactiveIds.length) {
    await prisma.inactiveUser.createMany({
      data: inactiveIds.map((userId) => ({ userId })),
      skipDuplicates: true,
    })
    console.log(`✓ inactive users (${inactiveIds.length})`)
  }

  // ── User profiles ───────────────────────────────────────────────────────────
  const profilesMap = await readJson<Record<string, {
    name?: string; email?: string; type?: string; photoPath?: string | null
  }>>("user-profiles.json", {})

  const profileEntries = Object.entries(profilesMap)
  if (profileEntries.length) {
    await prisma.userProfile.createMany({
      data: profileEntries.map(([userId, p]) => ({
        userId,
        name:      p.name ?? null,
        email:     p.email ?? null,
        type:      p.type ?? null,
        photoPath: p.photoPath ?? null,
      })),
      skipDuplicates: true,
    })
    console.log(`✓ user profiles  (${profileEntries.length})`)
  }

  // ── Integrações ─────────────────────────────────────────────────────────────
  const integracoes = await readJson<Array<{
    id: string; descricao?: string; provider: string; model: string;
    apiKey: string; active: boolean; createdAt: number
  }>>("integracoes.json", [])

  if (integracoes.length) {
    await prisma.integracao.createMany({
      data: integracoes.map((i) => ({
        id:        i.id,
        descricao: i.descricao ?? "",
        provider:  i.provider,
        model:     i.model,
        apiKey:    i.apiKey,
        active:    i.active ?? true,
        createdAt: i.createdAt ? new Date(i.createdAt) : new Date(),
      })),
      skipDuplicates: true,
    })
    console.log(`✓ integracoes    (${integracoes.length})`)
  }

  // ── Invite tokens ───────────────────────────────────────────────────────────
  const tokens = await readJson<Array<{
    token: string; userId: string; email: string; expiresAt: number; used: boolean
  }>>("invite-tokens.json", [])

  // Only seed valid (non-expired, non-used) tokens
  const validTokens = tokens.filter((t) => !t.used && Date.now() < t.expiresAt)
  if (validTokens.length) {
    await prisma.inviteToken.createMany({
      data: validTokens.map((t) => ({
        token:     t.token,
        userId:    t.userId,
        email:     t.email.toLowerCase(),
        expiresAt: new Date(t.expiresAt),
        used:      false,
      })),
      skipDuplicates: true,
    })
    console.log(`✓ invite tokens  (${validTokens.length})`)
  }

  console.log("\nSeed complete.")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
