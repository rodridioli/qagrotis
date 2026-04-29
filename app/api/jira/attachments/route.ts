import { auth } from "@/lib/auth"
import { NextRequest } from "next/server"
import { resolveJiraCredentialsForRequest } from "@/lib/jira-credentials-db"

const ISSUE_KEY_RE = /^[A-Z][A-Z0-9_]+-\d+$/

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 })

  let formData: FormData
  try { formData = await req.formData() }
  catch { return new Response("FormData inválido.", { status: 400 }) }

  const issueKey = formData.get("issueKey") as string
  if (!issueKey || !ISSUE_KEY_RE.test(issueKey)) {
    return new Response("issueKey inválido.", { status: 400 })
  }

  const resolved = await resolveJiraCredentialsForRequest(session.user.id)
  if (!resolved) {
    return new Response("Campos obrigatórios ausentes. Configure a Integração Jira em Configurações.", { status: 400 })
  }

  const { jiraUrl, jiraEmail: email, apiToken } = resolved
  const base = jiraUrl.replace(/\/$/, "")
  const credentials = Buffer.from(`${email}:${apiToken}`).toString("base64")

  const files = formData.getAll("files") as File[]
  const uploaded: { name: string; contentUrl: string }[] = []
  const errors: string[] = []

  for (const file of files) {
    try {
      const fd = new FormData()
      fd.append("file", file, file.name)

      const res = await fetch(`${base}/rest/api/3/issue/${issueKey}/attachments`, {
        method: "POST",
        headers: {
          "Authorization": `Basic ${credentials}`,
          "X-Atlassian-Token": "no-check",
          Accept: "application/json",
        },
        body: fd,
      })

      if (!res.ok) {
        const errText = await res.text().catch(() => res.statusText)
        errors.push(`${file.name}: ${errText.slice(0, 200)}`)
        continue
      }
      const data = await res.json() as Array<{ id: number; content: string }>
      const contentUrl = data[0]?.content ?? `${base}/rest/api/3/attachment/content/${data[0]?.id}`
      uploaded.push({ name: file.name, contentUrl })
    } catch (e) {
      errors.push(`${file.name}: ${e instanceof Error ? e.message : "falha no upload"}`)
    }
  }

  return Response.json({ uploaded, errors })
}
