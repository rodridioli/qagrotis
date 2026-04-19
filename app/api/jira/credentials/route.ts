import { auth } from "@/lib/auth"
import { NextRequest } from "next/server"
import { cookies } from "next/headers"

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30, // 30 days
}

// GET — return whether credentials are configured (without exposing the token)
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 })

  const cookieStore = await cookies()
  const jiraUrl   = cookieStore.get("jira_url")?.value ?? ""
  const jiraEmail = cookieStore.get("jira_email")?.value ?? ""
  const hasToken  = !!cookieStore.get("jira_token")?.value

  return Response.json({ jiraUrl, jiraEmail, hasToken, configured: !!(jiraUrl && jiraEmail && hasToken) })
}

// POST — save credentials in httpOnly cookies
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 })

  let body: { jiraUrl?: string; jiraEmail?: string; jiraToken?: string }
  try { body = await req.json() }
  catch { return new Response("JSON inválido.", { status: 400 }) }

  const { jiraUrl, jiraEmail, jiraToken } = body
  if (!jiraUrl?.trim() || !jiraEmail?.trim() || !jiraToken?.trim()) {
    return new Response("Campos obrigatórios ausentes.", { status: 400 })
  }

  const cookieStore = await cookies()
  cookieStore.set("jira_url",   jiraUrl.trim(),   COOKIE_OPTS)
  cookieStore.set("jira_email", jiraEmail.trim(), COOKIE_OPTS)
  cookieStore.set("jira_token", jiraToken.trim(), COOKIE_OPTS)

  return Response.json({ success: true })
}

// DELETE — clear credentials
export async function DELETE() {
  const session = await auth()
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 })

  const cookieStore = await cookies()
  cookieStore.delete("jira_url")
  cookieStore.delete("jira_email")
  cookieStore.delete("jira_token")

  return Response.json({ success: true })
}
