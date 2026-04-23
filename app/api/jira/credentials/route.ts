import { auth } from "@/lib/auth"
import { NextRequest } from "next/server"
import { cookies } from "next/headers"
import {
  deleteUserJiraCredentials,
  getUserJiraCredentials,
  upsertUserJiraCredentials,
} from "@/lib/jira-credentials-db"

const LEGACY_JIRA_COOKIES = ["jira_url", "jira_email", "jira_token"] as const

/** Remove cookies antigos (migração para armazenamento no banco). */
async function clearLegacyCookiesOnce() {
  const cookieStore = await cookies()
  for (const name of LEGACY_JIRA_COOKIES) {
    cookieStore.delete(name)
  }
}

// GET — credenciais configuradas (sem expor o token)
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 })

  const row = await getUserJiraCredentials(session.user.id)
  const jiraUrl = row?.jiraUrl ?? ""
  const jiraEmail = row?.jiraEmail ?? ""
  const hasToken = !!(row?.apiToken?.trim())

  return Response.json({ jiraUrl, jiraEmail, hasToken, configured: !!(jiraUrl && jiraEmail && hasToken) })
}

// POST — grava integração Jira por usuário (PostgreSQL)
export async function POST(req: NextRequest) {
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

  try {
    await upsertUserJiraCredentials(session.user.id, {
      jiraUrl: jiraUrl.trim(),
      jiraEmail: jiraEmail.trim(),
      apiToken: jiraToken,
    })
  } catch (e) {
    if (e instanceof Error && e.message === "MISSING_TOKEN") {
      return new Response("Informe o API Token na primeira configuração ou ao trocar o token.", { status: 400 })
    }
    throw e
  }

  await clearLegacyCookiesOnce()

  return Response.json({ success: true })
}

// DELETE — remove integração do usuário
export async function DELETE() {
  const session = await auth()
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 })

  await deleteUserJiraCredentials(session.user.id)
  await clearLegacyCookiesOnce()

  return Response.json({ success: true })
}
