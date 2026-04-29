/**
 * Seed test users covering RBAC profile combinations for local manual testing.
 * Run: npx tsx scripts/seed-rbac-test-users.ts
 */
import "dotenv/config"
import { prisma } from "../lib/prisma"
import { hashPassword } from "../lib/db-utils"

type UserType = "Padrão" | "Administrador"
type AccessProfile = "QA" | "UX" | "TW" | "MGR"

const SEEDS: { id: string; name: string; email: string; type: UserType; accessProfile: AccessProfile }[] = [
  { id: "T-PQA", name: "Padrão QA",  email: "padrao.qa@local.dev",  type: "Padrão",        accessProfile: "QA" },
  { id: "T-AQA", name: "Admin QA",   email: "admin.qa@local.dev",   type: "Administrador", accessProfile: "QA" },
  { id: "T-PUX", name: "Padrão UX",  email: "padrao.ux@local.dev",  type: "Padrão",        accessProfile: "UX" },
  { id: "T-AUX", name: "Admin UX",   email: "admin.ux@local.dev",   type: "Administrador", accessProfile: "UX" },
  { id: "T-PTW", name: "Padrão TW",  email: "padrao.tw@local.dev",  type: "Padrão",        accessProfile: "TW" },
  { id: "T-ATW", name: "Admin TW",   email: "admin.tw@local.dev",   type: "Administrador", accessProfile: "TW" },
  { id: "T-AMG", name: "Admin MGR",  email: "admin.mgr@local.dev",  type: "Administrador", accessProfile: "MGR" },
]

const PASSWORD = "Local#1234"

async function main() {
  const password = hashPassword(PASSWORD)
  for (const u of SEEDS) {
    await prisma.createdUser.upsert({
      where: { email: u.email },
      update: { name: u.name, type: u.type, accessProfile: u.accessProfile },
      create: { id: u.id, name: u.name, email: u.email, type: u.type, accessProfile: u.accessProfile, password },
    })
    await prisma.userProfile.upsert({
      where: { userId: u.id },
      update: { name: u.name, email: u.email, type: u.type, accessProfile: u.accessProfile },
      create: { userId: u.id, name: u.name, email: u.email, type: u.type, accessProfile: u.accessProfile },
    })
    console.log(`✔ ${u.email}  (${u.type} / ${u.accessProfile})`)
  }
  console.log(`\nSenha padrão: ${PASSWORD}`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
