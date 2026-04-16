import { NextRequest } from "next/server"
import * as jose from "jose"

export async function GET(_req: NextRequest) {
  const token = process.env.GITBOOK_API_TOKEN ?? ""
  const key = process.env.GITBOOK_PRIVATE_KEY ?? ""
  const orgId = "YJL6kpwzoMMhtvwRrmNt"
  const siteId = "site_YbjJD"

  if (!token || !key) {
    return Response.json({ error: "Missing env vars", token: !!token, key: !!key })
  }

  const visitorJWT = await new jose.SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(new TextEncoder().encode(key))

  const res = await fetch(
    `https://api.gitbook.com/v1/orgs/${orgId}/sites/${siteId}/ask`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-GitBook-Token": visitorJWT,
      },
      body: JSON.stringify({
        question: "o que é produtor rural?",
        scope: { mode: "default" },
        visitor: { jwtToken: visitorJWT },
      }),
    }
  )

  const raw = await res.text()
  return Response.json({
    status: res.status,
    rawLength: raw.length,
    rawPreview: raw.slice(0, 2000),
    lines: raw.split("\n").filter(l => l.startsWith("data:")).length,
  })
}
