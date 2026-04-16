import { NextRequest } from "next/server"

export async function GET(_req: NextRequest) {
  const token = process.env.GITBOOK_API_TOKEN ?? ""
  const key = process.env.GITBOOK_PRIVATE_KEY ?? ""

  // Test token against GitBook API
  let gitbookStatus = "not tested"
  if (token) {
    try {
      const res = await fetch("https://api.gitbook.com/v1/user", {
        headers: { "Authorization": `Bearer ${token}` }
      })
      const body = await res.text()
      gitbookStatus = `${res.status}: ${body.slice(0, 100)}`
    } catch (e) {
      gitbookStatus = `fetch error: ${e}`
    }
  }

  return new Response(JSON.stringify({
    GITBOOK_API_TOKEN: token ? `SET (${token.length} chars, starts: ${token.slice(0,4)}, ends: ${token.slice(-4)})` : "NOT SET",
    GITBOOK_PRIVATE_KEY: key ? `SET (${key.length} chars)` : "NOT SET",
    gitbook_api_test: gitbookStatus,
  }, null, 2), { headers: { "Content-Type": "application/json" } })
}
