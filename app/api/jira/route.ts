import { auth } from "@/lib/auth"
import { NextRequest } from "next/server"
import { isSafeExternalUrl } from "@/lib/security"

// GET is no longer supported - all Jira calls use POST with action field
// This handler prevents 404 errors from cached old code
export async function GET() {
  return new Response(
    JSON.stringify({ error: "Use POST with action: 'fetch' or 'update'" }),
    { status: 405, headers: { "Content-Type": "application/json", "Allow": "POST" } }
  )
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 })

  let body: {
    action?: "fetch" | "update"
    jiraUrl: string
    issueKey: string
    apiToken: string
    email: string
    content?: string
    mode?: "replace" | "append"
    deleteAttachmentIds?: number[]
  }
  try { body = await req.json() }
  catch { return new Response("JSON inválido.", { status: 400 }) }

  let { action = "update", jiraUrl, issueKey, apiToken, email } = body as typeof body & { action?: string }

  // If credentials not in body, try server-side cookies (httpOnly, not accessible from JS)
  if (!jiraUrl || !apiToken || !email) {
    const { cookies } = await import("next/headers")
    const cookieStore = await cookies()
    jiraUrl   = jiraUrl   || cookieStore.get("jira_url")?.value   || ""
    email     = email     || cookieStore.get("jira_email")?.value || ""
    apiToken  = apiToken  || cookieStore.get("jira_token")?.value || ""
  }

  if (!jiraUrl || !issueKey || !apiToken || !email) {
    return new Response("Campos obrigatórios ausentes. Configure a Integração Jira em Configurações.", { status: 400 })
  }

  const base = jiraUrl.replace(/\/$/, "")

  if (!isSafeExternalUrl(base)) {
    return new Response("URL Jira inválida. Use uma URL HTTPS pública (ex: https://sua-empresa.atlassian.net).", { status: 400 })
  }
  const credentials = Buffer.from(`${email}:${apiToken}`).toString("base64")

  // ── action: fetch — get current description ──────────────────────────────
  if (action === "fetch") {
    const res = await fetch(`${base}/rest/api/3/issue/${issueKey}?fields=description,summary,attachment`, {
      headers: { "Authorization": `Basic ${credentials}`, "Accept": "application/json" },
    })

    if (!res.ok) {
      const err = await res.text()
      return new Response(`Erro Jira ${res.status}: ${err.slice(0, 300)}`, { status: res.status })
    }

    const data = await res.json() as {
      fields?: {
        summary?: string
        description?: { content?: unknown[] } | null
        attachment?: { id: string; filename: string; mimeType: string; content: string; size: number }[]
      }
    }

    const summary = data.fields?.summary ?? ""
    const descAdf = data.fields?.description
    const descText = descAdf ? adfToText(descAdf) : ""

    const attachments = data.fields?.attachment ?? []
    const attachmentIds = attachments.map(a => Number(a.id))

    const supported = attachments.filter(a =>
      a.size < 5 * 1024 * 1024 &&
      (a.mimeType.startsWith("image/") || a.mimeType === "application/pdf")
    ).slice(0, 5)

    const attachmentData: { name: string; mimeType: string; dataUrl: string }[] = []
    for (const att of supported) {
      try {
        if (!isSafeExternalUrl(att.content)) continue
        const attRes = await fetch(att.content, { headers: { "Authorization": `Basic ${credentials}` } })
        if (attRes.ok) {
          const buf = await attRes.arrayBuffer()
          const base64 = Buffer.from(buf).toString("base64")
          attachmentData.push({ name: att.filename, mimeType: att.mimeType, dataUrl: `data:${att.mimeType};base64,${base64}` })
        }
      } catch { /* skip */ }
    }

    return Response.json({ summary, descText, hasContent: descText.trim().length > 0, attachments: attachmentData, attachmentIds })
  }

  // ── action: update — write description ───────────────────────────────────
  const { content, mode, deleteAttachmentIds } = body
  if (!content) return new Response("Conteúdo obrigatório.", { status: 400 })

  // Quando substituindo, remove os anexos existentes indicados pelo cliente
  if (mode === "replace" && deleteAttachmentIds?.length) {
    for (const id of deleteAttachmentIds) {
      try {
        await fetch(`${base}/rest/api/3/attachment/${id}`, {
          method: "DELETE",
          headers: { "Authorization": `Basic ${credentials}` },
        })
      } catch { /* skip */ }
    }
  }

  let adf: object
  if (mode === "append") {
    const getRes = await fetch(`${base}/rest/api/3/issue/${issueKey}?fields=description`, {
      headers: { "Authorization": `Basic ${credentials}`, "Accept": "application/json" },
    })
    if (getRes.ok) {
      const existing = await getRes.json() as { fields?: { description?: { version: number; type: string; content: unknown[] } | null } }
      const existingAdf = existing.fields?.description
      if (existingAdf?.content) {
        const newAdf = markdownToADF(content) as { version: number; type: string; content: unknown[] }
        adf = { version: 1, type: "doc", content: [...existingAdf.content, { type: "rule" }, ...newAdf.content] }
      } else {
        adf = markdownToADF(content)
      }
    } else {
      adf = markdownToADF(content)
    }
  } else {
    adf = markdownToADF(content)
  }

  const res = await fetch(`${base}/rest/api/3/issue/${issueKey}`, {
    method: "PUT",
    headers: { "Authorization": `Basic ${credentials}`, "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({ fields: { description: adf } }),
  })

  if (!res.ok) {
    const err = await res.text()
    return new Response(`Erro Jira ${res.status}: ${err.slice(0, 300)}`, { status: res.status })
  }

  return new Response(JSON.stringify({ success: true, url: `${base}/browse/${issueKey}` }), {
    headers: { "Content-Type": "application/json" },
  })
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function adfToText(node: unknown): string {
  if (!node || typeof node !== "object") return ""
  const n = node as Record<string, unknown>
  if (n.type === "text") return (n.text as string) ?? ""
  if (Array.isArray(n.content)) {
    const children = (n.content as unknown[]).map(adfToText).join("")
    if (n.type === "paragraph") return children + "\n"
    if (n.type === "heading") return children + "\n"
    if (n.type === "listItem") return "• " + children
    if (n.type === "rule") return "---\n"
    return children
  }
  return ""
}

function inlineToADF(text: string): object[] {
  const nodes: object[] = []
  const re = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|\[(.+?)\]\((.+?)\)|([^*`[\]]+))/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m[2]) nodes.push({ type: "text", text: m[2], marks: [{ type: "strong" }] })
    else if (m[3]) nodes.push({ type: "text", text: m[3], marks: [{ type: "em" }] })
    else if (m[4]) nodes.push({ type: "text", text: m[4], marks: [{ type: "code" }] })
    else if (m[5] && m[6]) nodes.push({ type: "text", text: m[5], marks: [{ type: "link", attrs: { href: m[6] } }] })
    else if (m[7]) nodes.push({ type: "text", text: m[7] })
  }
  return nodes.length > 0 ? nodes : [{ type: "text", text }]
}

function stripMd(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1").replace(/`(.+?)`/g, "$1").trim()
}

function markdownToADF(markdown: string): object {
  const content: object[] = []
  const lines = markdown.split("\n")
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const heading = line.match(/^(#{1,6})\s+(.+)/)
    if (heading) {
      content.push({ type: "heading", attrs: { level: Math.min(heading[1].length, 6) }, content: [{ type: "text", text: stripMd(heading[2]) }] })
      i++; continue
    }
    const img = line.match(/^!\[(.+?)\]\((.+?)\)$/)
    if (img) {
      content.push({ type: "mediaSingle", attrs: { layout: "center" }, content: [{ type: "media", attrs: { type: "external", url: img[2], alt: img[1] } }] })
      i++; continue
    }
    if (/^---+$/.test(line.trim())) { content.push({ type: "rule" }); i++; continue }
    if (line.startsWith("|")) {
      const rows: string[][] = []
      while (i < lines.length && lines[i].startsWith("|")) {
        const row = lines[i].split("|").slice(1, -1).map(c => c.trim())
        if (!row.every(c => /^[-:]+$/.test(c))) rows.push(row)
        i++
      }
      if (rows.length > 0) {
        content.push({
          type: "table", attrs: { isNumberColumnEnabled: false, layout: "default" },
          content: rows.map((row, ri) => ({
            type: "tableRow",
            content: row.map(cell => ({
              type: ri === 0 ? "tableHeader" : "tableCell",
              attrs: {},
              content: [{ type: "paragraph", content: [{ type: "text", text: stripMd(cell) }] }],
            })),
          })),
        })
      }
      continue
    }
    if (/^[-*]\s/.test(line)) {
      const items: object[] = []
      while (i < lines.length && /^[-*]\s/.test(lines[i])) {
        items.push({ type: "listItem", content: [{ type: "paragraph", content: inlineToADF(lines[i].replace(/^[-*]\s/, "")) }] })
        i++
      }
      content.push({ type: "bulletList", content: items }); continue
    }
    if (/^\d+\.\s/.test(line)) {
      const items: object[] = []
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push({ type: "listItem", content: [{ type: "paragraph", content: inlineToADF(lines[i].replace(/^\d+\.\s/, "")) }] })
        i++
      }
      content.push({ type: "orderedList", content: items }); continue
    }
    if (!line.trim()) { i++; continue }
    content.push({ type: "paragraph", content: inlineToADF(line) })
    i++
  }
  return { version: 1, type: "doc", content }
}
// force-deploy-1776426959
