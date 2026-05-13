import { auth } from "@/core/auth"
import { buildRole, can } from "@/core/rbac/policy"
import { validateOrigin } from "@/core/security"
import {
  deleteClockworkIntegration,
  isClockworkTokenStoredInDb,
  upsertClockworkApiToken,
} from "@/features/qa/lib/clockwork-credentials-db"
import { env } from "@/core/env"
import type { NextRequest } from "next/server"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }
  const role = buildRole(session.user.type, session.user.accessProfile)
  if (!can(role, "config.clockwork")) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const hasTokenInDb = await isClockworkTokenStoredInDb()
    const hasEnvFallback = !!env.CLOCKWORK_API_TOKEN.trim()
    return Response.json({
      configured: hasTokenInDb,
      hasToken: hasTokenInDb,
      hasEnvFallback,
    })
  } catch (e) {
    if (process.env.NODE_ENV !== "production") console.error("[clockwork/credentials] GET:", e)
    return Response.json({
      configured: false,
      hasToken: false,
      hasEnvFallback: !!env.CLOCKWORK_API_TOKEN.trim(),
    })
  }
}

export async function POST(req: NextRequest) {
  const csrfError = validateOrigin(req)
  if (csrfError) return csrfError

  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }
  const role = buildRole(session.user.type, session.user.accessProfile)
  if (!can(role, "config.clockwork")) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  let body: { apiToken?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "JSON inválido." }, { status: 400 })
  }

  const apiToken = body.apiToken

  if (!apiToken?.trim()) {
    const inDb = await isClockworkTokenStoredInDb()
    if (!inDb) {
      return Response.json(
        { error: "Informe o API Token na primeira configuração ou ao trocar o token." },
        { status: 400 },
      )
    }
  }

  try {
    await upsertClockworkApiToken(session.user.id, apiToken)
  } catch (e) {
    console.error("[clockwork/credentials] POST:", e)
    if (e instanceof Error && e.message === "MISSING_TOKEN") {
      return Response.json({ error: "Informe o API Token." }, { status: 400 })
    }
    const msg = e instanceof Error ? e.message : ""
    if (msg.includes("ENCRYPTION_KEY")) {
      return Response.json(
        { error: "Configuração incompleta no servidor: variável ENCRYPTION_KEY não definida. Contacte o administrador." },
        { status: 503 },
      )
    }
    if (msg.includes("does not exist") || msg.includes("P2021") || msg.includes("relation") || msg.includes("ClockworkIntegration")) {
      return Response.json(
        { error: "Tabela de integração não encontrada. Execute prisma migrate deploy no ambiente de deploy." },
        { status: 503 },
      )
    }
    return Response.json({ error: "Não foi possível gravar. Verifique os logs do servidor." }, { status: 503 })
  }

  return Response.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const csrfError = validateOrigin(req)
  if (csrfError) return csrfError

  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }
  const role = buildRole(session.user.type, session.user.accessProfile)
  if (!can(role, "config.clockwork")) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  await deleteClockworkIntegration()
  return Response.json({ success: true })
}
