import { NextRequest } from "next/server"

export async function GET(_req: NextRequest) {
  const token = process.env.GITBOOK_API_TOKEN ?? ""
  const key = process.env.GITBOOK_PRIVATE_KEY ?? ""
  return new Response(JSON.stringify({
    GITBOOK_API_TOKEN: token ? `SET (${token.length} chars, starts: ${token.slice(0,4)})` : "NOT SET",
    GITBOOK_PRIVATE_KEY: key ? `SET (${key.length} chars, starts: ${key.slice(0,4)})` : "NOT SET",
  }), { headers: { "Content-Type": "application/json" } })
}
