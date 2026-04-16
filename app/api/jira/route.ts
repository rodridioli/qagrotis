import { auth } from "@/lib/auth"
import { NextRequest } from "next/server"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 })

  let body: {
    jiraUrl: string
    issueKey: string
    apiToken: string
    email: string
    content: string
  }
  try { body = await req.json() }
  catch { return new Response("JSON inválido.", { status: 400 }) }

  const { jiraUrl, issueKey, apiToken, email, content } = body
  if (!jiraUrl || !issueKey || !apiToken || !email) {
    return new Response("Campos obrigatórios ausentes.", { status: 400 })
  }

  const base = jiraUrl.replace(/\/$/, "")
  const credentials = Buffer.from(`${email}:${apiToken}`).toString("base64")
  const adf = markdownToADF(content)

  const res = await fetch(`${base}/rest/api/3/issue/${issueKey}`, {
    method: "PUT",
    headers: {
      "Authorization": `Basic ${credentials}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
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
    if (/^---+$/.test(line.trim())) {
      content.push({ type: "rule" }); i++; continue
    }
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
