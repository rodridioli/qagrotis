/**
 * Remove do Postgres dados de usuário associados a um e-mail (CreatedUser, Auth User, perfil, convites, etc.).
 * Usa apenas `pg` — não depende de `prisma generate`.
 *
 * Uso:
 *   npx tsx scripts/delete-user-by-email.ts <email>
 */

import { readFileSync } from "fs"
import { resolve } from "path"
import { Pool } from "pg"

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
} catch {
  /* ignore */
}

function normEmail(s: string) {
  return s.trim().toLowerCase()
}

function placeholders(start: number, n: number) {
  return Array.from({ length: n }, (_, i) => `$${start + i}`).join(", ")
}

async function deleteOneEmail(pool: Pool, rawEmail: string) {
  const email = normEmail(rawEmail)
  if (!email || !email.includes("@")) {
    console.warn(`Ignorando e-mail inválido: ${rawEmail}`)
    return
  }

  const client = await pool.connect()
  try {
    const created = await client.query<{ id: string }>(
      `SELECT id FROM "CreatedUser" WHERE LOWER(email) = LOWER($1)`,
      [email],
    )
    const auth = await client.query<{ id: string }>(
      `SELECT id FROM "User" WHERE LOWER(email) = LOWER($1)`,
      [email],
    )

    const ids = new Set<string>()
    for (const row of created.rows) ids.add(row.id)
    for (const row of auth.rows) ids.add(row.id)
    const idList = [...ids]

    await client.query("BEGIN")
    try {
      if (idList.length > 0) {
        const phInvite = placeholders(2, idList.length)
        await client.query(
          `DELETE FROM "InviteToken" WHERE LOWER(email) = LOWER($1) OR "userId" IN (${phInvite})`,
          [email, ...idList],
        )
        const phIds = placeholders(1, idList.length)
        await client.query(`DELETE FROM "InactiveUser" WHERE "userId" IN (${phIds})`, idList)
        const emailPh = idList.length + 1
        await client.query(
          `DELETE FROM "UserProfile" WHERE "userId" IN (${phIds}) OR (email IS NOT NULL AND LOWER(email) = LOWER($${emailPh}))`,
          [...idList, email],
        )
      } else {
        await client.query(`DELETE FROM "InviteToken" WHERE LOWER(email) = LOWER($1)`, [email])
        await client.query(
          `DELETE FROM "UserProfile" WHERE email IS NOT NULL AND LOWER(email) = LOWER($1)`,
          [email],
        )
      }

      await client.query(`DELETE FROM "CreatedUser" WHERE LOWER(email) = LOWER($1)`, [email])
      await client.query(`DELETE FROM "QaUser" WHERE LOWER(email) = LOWER($1)`, [email])
      await client.query(
        `UPDATE "Cenario" SET "createdBy" = NULL WHERE "createdBy" IS NOT NULL AND LOWER("createdBy") = LOWER($1)`,
        [email],
      )
      await client.query(`DELETE FROM "User" WHERE LOWER(email) = LOWER($1)`, [email])

      await client.query("COMMIT")
    } catch (e) {
      await client.query("ROLLBACK")
      throw e
    }

    console.log(`✓ Removido do banco: ${email} (ids considerados: ${idList.join(", ") || "—"})`)
  } finally {
    client.release()
  }
}

async function main() {
  const args = process.argv.slice(2)
  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) {
    console.error("DATABASE_URL não definida.")
    process.exit(1)
  }

  const pool = new Pool({ connectionString: dbUrl })
  try {
    const emailArg = args.find((a) => !a.startsWith("--"))
    if (!emailArg) {
      console.error("Uso: npx tsx scripts/delete-user-by-email.ts <email>")
      process.exit(1)
    }
    await deleteOneEmail(pool, emailArg)
  } finally {
    await pool.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
