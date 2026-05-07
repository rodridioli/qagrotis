import { auth } from "@/lib/auth"
import { NextRequest } from "next/server"
import { cookies } from "next/headers"
import {
  deleteUserJiraCredentials,
  getUserJiraCredentials,
  readLegacyJiraCookies,
  upsertUserJiraCredentials,
} from "@/lib/jira-credentials-db"
import { validateOrigin } from "@/lib/security"

const LEGACY_JIRA_COOKIES = ["jira_url", "jira_email", "jira_token"] as const

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
}

/** Remove cookies legados após persistência bem-sucedida na BD. */
async function clearLegacyCookiesOnce() {
  const cookieStore = await cookies()
  for (const name of LEGACY_JIRA_COOKIES) {
    cookieStore.delete(name)
  }
}

async function saveToLegacyCookies(jiraUrl: string, jiraEmail: string, jiraToken: string) {
  const cookieStore = await cookies()
  cookieStore.set("jira_url", jiraUrl, COOKIE_OPTS)
  cookieStore.set("jira_email", jiraEmail, COOKIE_OPTS)
  cookieStore.set("jira_token", jiraToken, COOKIE_OPTS)
}

// GET — credenciais configuradas (sem expor o token)
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 })

  try {
    const db = await getUserJiraCredentials(session.user.id)
    const leg = await readLegacyJiraCookies()
    const jiraUrl = (db?.jiraUrl || leg?.jiraUrl || "").trim()
    const jiraEmail = (db?.jiraEmail || leg?.jiraEmail || "").trim()
    const hasToken = !!(db?.apiToken?.trim() || leg?.apiToken?.trim())

    return Response.json({
      jiraUrl,
      jiraEmail,
      hasToken,
      configured: !!(jiraUrl && jiraEmail && hasToken),
    })
  } catch (e) {
    if (process.env.NODE_ENV !== "production") console.error("[jira/credentials] GET:", e)
    return Response.json(
      { jiraUrl: "", jiraEmail: "", hasToken: false, configured: false },
      { status: 200 },
    )
  }
}

// POST — grava integração Jira por usuário (PostgreSQL), com fallback para cookies se a migração não existir
export async function POST(req: NextRequest) {
  const csrfError = validateOrigin(req)
  if (csrfError) return csrfError
  const session = await auth()
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 })

  let body: { jiraUrl?: string; jiraEmail?: string; jiraToken?: string }
  try {
    body = await req.json()
  } catch {
    return new Response("JSON inválido.", { status: 400 })
  }

  const { jiraUrl, jiraEmail, jiraToken } = body
  if (!jiraUrl?.trim() || !jiraEmail?.trim()) {
    return new Response("Campos obrigatórios ausentes.", { status: 400 })
  }

  if (!jiraToken?.trim()) {
    const existing = await getUserJiraCredentials(session.user.id)
    const leg = await readLegacyJiraCookies()
    const hasStored = !!(existing?.apiToken?.trim() || leg?.apiToken?.trim())
    if (!hasStored) {
      return new Response("Informe o API Token na primeira configuração ou ao trocar o token.", { status: 400 })
    }
  }

  let savedToDb = false
  try {
    await upsertUserJiraCredentials(session.user.id, {
      jiraUrl: jiraUrl.trim(),
      jiraEmail: jiraEmail.trim(),
      apiToken: jiraToken,
    })
    savedToDb = true
  } catch (e) {
    if (e instanceof Error && e.message === "MISSING_TOKEN") {
      return new Response("Informe o API Token na primeira configuração ou ao trocar o token.", { status: 400 })
    }
    if (process.env.NODE_ENV !== "production") console.error("[jira/credentials] POST: falha na BD — usando cookies (rode prisma migrate deploy).", e)
    const token =
      jiraToken?.trim() ||
      (await getUserJiraCredentials(session.user.id))?.apiToken ||
      (await readLegacyJiraCookies())?.apiToken ||
      ""
    if (!token.trim()) {
      return new Response(
        "Não foi possível gravar no banco e não há token armazenado. Rode a migração Prisma ou informe o API Token.",
        { status: 503 },
      )
    }
    await saveToLegacyCookies(jiraUrl.trim(), jiraEmail.trim(), token.trim())
  }

  if (savedToDb) {
    await clearLegacyCookiesOnce()
  }

  return Response.json({ success: true })
}

// DELETE — remove integração do usuário
export async function DELETE(req: NextRequest) {
  const csrfError = validateOrigin(req)
  if (csrfError) return csrfError
  const session = await auth()
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 })

  await deleteUserJiraCredentials(session.user.id)
  await clearLegacyCookiesOnce()

  return Response.json({ success: true })
}
