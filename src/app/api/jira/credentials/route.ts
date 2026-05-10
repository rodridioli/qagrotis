import { auth } from "@/core/auth"
import { NextRequest } from "next/server"
import { cookies } from "next/headers"
import {
  deleteUserJiraCredentials,
  getGlobalJiraCredentials,
  upsertUserJiraCredentials,
} from "@/features/qa/lib/jira-credentials-db"
import { validateOrigin } from "@/core/security"

const LEGACY_JIRA_COOKIES = ["jira_url", "jira_email", "jira_token"] as const

/** Remove cookies legados após persistência bem-sucedida na BD. */
async function clearLegacyCookiesOnce() {
  const cookieStore = await cookies()
  for (const name of LEGACY_JIRA_COOKIES) {
    cookieStore.delete(name)
  }
}

/** Verifica que o usuário é Administrador:MGR — único perfil autorizado a gerenciar a config global do Jira. */
function isMgrAdmin(session: { user: { type?: string | null; accessProfile?: string | null } }): boolean {
  return session.user.type === "Administrador" && session.user.accessProfile === "MGR"
}

// GET — retorna configuração global do Jira (qualquer usuário autenticado pode consultar o status)
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 })

  try {
    const creds = await getGlobalJiraCredentials()
    return Response.json({
      jiraUrl:    creds?.jiraUrl   ?? "",
      jiraEmail:  creds?.jiraEmail ?? "",
      hasToken:   !!creds?.apiToken,
      configured: !!(creds?.jiraUrl && creds?.jiraEmail && creds?.apiToken),
    })
  } catch (e) {
    if (process.env.NODE_ENV !== "production") console.error("[jira/credentials] GET:", e)
    return Response.json(
      { jiraUrl: "", jiraEmail: "", hasToken: false, configured: false },
      { status: 200 },
    )
  }
}

// POST — grava configuração global do Jira (somente Administrador:MGR)
export async function POST(req: NextRequest) {
  const csrfError = validateOrigin(req)
  if (csrfError) return csrfError
  const session = await auth()
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 })
  if (!isMgrAdmin(session)) return new Response("Forbidden", { status: 403 })

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
    const existing = await getGlobalJiraCredentials()
    if (!existing?.apiToken?.trim()) {
      return new Response("Informe o API Token na primeira configuração ou ao trocar o token.", { status: 400 })
    }
  }

  try {
    await upsertUserJiraCredentials(session.user.id, {
      jiraUrl:   jiraUrl.trim(),
      jiraEmail: jiraEmail.trim(),
      apiToken:  jiraToken,
    })
    await clearLegacyCookiesOnce()
  } catch (e) {
    if (e instanceof Error && e.message === "MISSING_TOKEN") {
      return new Response("Informe o API Token na primeira configuração ou ao trocar o token.", { status: 400 })
    }
    console.error("[jira/credentials] POST:", e)
    return new Response("Erro ao salvar configuração no banco de dados.", { status: 500 })
  }

  return Response.json({ success: true })
}

// DELETE — remove configuração global do Jira (somente Administrador:MGR)
export async function DELETE(req: NextRequest) {
  const csrfError = validateOrigin(req)
  if (csrfError) return csrfError
  const session = await auth()
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 })
  if (!isMgrAdmin(session)) return new Response("Forbidden", { status: 403 })

  await deleteUserJiraCredentials(session.user.id)
  const cookieStore = await cookies()
  for (const name of LEGACY_JIRA_COOKIES) cookieStore.delete(name)

  return Response.json({ success: true })
}
