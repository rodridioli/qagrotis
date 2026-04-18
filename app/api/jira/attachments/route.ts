import { auth } from "@/lib/auth"
import { NextRequest } from "next/server"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 })

  let formData: FormData
  try { formData = await req.formData() }
  catch { return new Response("FormData inválido.", { status: 400 }) }

  const issueKey = formData.get("issueKey") as string
  let jiraUrl   = formData.get("jiraUrl")   as string | null ?? ""
  let email     = formData.get("email")     as string | null ?? ""
  let apiToken  = formData.get("apiToken")  as string | null ?? ""

  if (!jiraUrl || !email || !apiToken) {
    const { cookies } = await import("next/headers")
    const cookieStore = await cookies()
    jiraUrl  = jiraUrl  || cookieStore.get("jira_url")?.value   || ""
    email    = email    || cookieStore.get("jira_email")?.value || ""
    apiToken = apiToken || cookieStore.get("jira_token")?.value || ""
  }

  if (!jiraUrl || !issueKey || !apiToken || !email) {
    return new Response("Campos obrigatórios ausentes. Configure a Integração Jira em Configurações.", { status: 400 })
  }

  const base = jiraUrl.replace(/\/$/, "")
  const credentials = Buffer.from(`${email}:${apiToken}`).toString("base64")

  const files = formData.getAll("files") as File[]
  const uploaded: { name: string; contentUrl: string }[] = []

  for (const file of files) {
    try {
      const fd = new FormData()
      fd.append("file", file, file.name)

      const res = await fetch(`${base}/rest/api/3/issue/${issueKey}/attachments`, {
        method: "POST",
        headers: {
          "Authorization": `Basic ${credentials}`,
          "X-Atlassian-Token": "no-check",
        },
        body: fd,
      })

      if (res.ok) {
        const data = await res.json() as Array<{ id: number; content: string }>
        const contentUrl = data[0]?.content ?? `${base}/rest/api/3/attachment/content/${data[0]?.id}`
        uploaded.push({ name: file.name, contentUrl })
      }
    } catch { /* skip individual file failures */ }
  }

  return Response.json({ uploaded })
}
