import { auth } from "@/core/auth"
import { validateOrigin } from "@/core/security"
import { buildRole, can, manageableProfiles } from "@/core/rbac/policy"
import { getClockworkApiTokenResolved } from "@/features/qa/lib/clockwork-credentials-db"
import { fetchClockworkWorklogsForEmail } from "@/features/qa/lib/clockwork-worklogs-fetch"
import { getActiveQaUsers, resolveEmailForQaUserId } from "@/features/usuarios/actions/usuarios"
import { z } from "zod"
import type { NextRequest } from "next/server"

const CW_HOST = "https://api.clockwork.report"

// ── Helpers ───────────────────────────────────────────────────────────────────

function currentMonthRange(): { fromIso: string; toIso: string } {
  const now = new Date()
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth()
  const from = new Date(Date.UTC(year, month, 1))
  const to = new Date(Date.UTC(year, month + 1, 0))
  const pad = (n: number) => String(n).padStart(2, "0")
  return {
    fromIso: `${from.getUTCFullYear()}-${pad(from.getUTCMonth() + 1)}-${pad(from.getUTCDate())}`,
    toIso:   `${to.getUTCFullYear()}-${pad(to.getUTCMonth() + 1)}-${pad(to.getUTCDate())}`,
  }
}

// ── GET — lista worklogs do mês corrente para um userId ───────────────────────

export async function GET(req: NextRequest) {
  const csrfError = validateOrigin(req)
  if (csrfError) return csrfError

  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const role = buildRole(session.user.type, session.user.accessProfile)
  if (!can(role, "equipe.clockwork")) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const url = new URL(req.url)
  const requestedUserId = url.searchParams.get("userId")?.trim()
  if (!requestedUserId) {
    return Response.json({ error: "Parâmetro userId é obrigatório." }, { status: 400 })
  }

  // Autorização: admin pode ver membros dos seus perfis gerenciáveis
  const canViewOthers = can(role, "individual.viewOthers")
  if (requestedUserId !== session.user.id) {
    if (!canViewOthers && !can(role, "equipe.clockwork")) {
      return Response.json({ error: "Forbidden" }, { status: 403 })
    }
    if (!canViewOthers) {
      const activeUsers = await getActiveQaUsers()
      const target = activeUsers.find((u) => u.id === requestedUserId)
      if (!target) {
        return Response.json({ error: "Utilizador não encontrado." }, { status: 403 })
      }
      const allowed = manageableProfiles(role)
      if (!target.accessProfile || !allowed.includes(target.accessProfile as "QA" | "UX" | "TW" | "MGR")) {
        return Response.json({ error: "Forbidden" }, { status: 403 })
      }
    }
  }

  const targetEmail = await resolveEmailForQaUserId(requestedUserId)
  if (!targetEmail) {
    return Response.json({ error: "Não foi possível resolver o e-mail do utilizador." }, { status: 400 })
  }

  const token = await getClockworkApiTokenResolved().catch(() => "")
  if (!token) {
    return Response.json({ error: "CLOCKWORK_NOT_CONFIGURED" }, { status: 400 })
  }

  const { fromIso, toIso } = currentMonthRange()

  try {
    const worklogs = await fetchClockworkWorklogsForEmail({
      token,
      emailNorm: targetEmail.trim().toLowerCase(),
      fromIso,
      toIso,
      timeZoneId: "America/Sao_Paulo",
    })

    // Normalise: strip the "cw-" prefix from IDs so the client has the raw Clockwork ID
    const items = worklogs.map((w) => ({
      id: w.id.startsWith("cw-") ? w.id.slice(3) : w.id,
      issueKey: w.issueKey,
      summary: w.summary,
      started: w.started,
      timeSpentSeconds: w.timeSpentSeconds,
      comment: w.comment,
    }))

    const now = new Date()
    const monthLabel = new Intl.DateTimeFormat("pt-BR", {
      month: "long",
      year: "numeric",
      timeZone: "America/Sao_Paulo",
    }).format(now)

    return Response.json({ worklogs: items, month: monthLabel, fromIso, toIso })
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[api/clockwork/worklogs GET]", e)
    }
    return Response.json({ error: "Erro ao buscar worklogs do Clockwork." }, { status: 500 })
  }
}

// ── PATCH — atualiza um worklog específico no Clockwork ───────────────────────

const PatchBodySchema = z.object({
  worklogId: z.string().min(1),
  started: z.string().min(1),           // ISO datetime (ex: "2026-05-28T09:00:00.000Z")
  timeSpentSeconds: z.number().int().positive(),
  comment: z.string().max(2000),
})

export type ClockworkPatchBody = z.infer<typeof PatchBodySchema>

export async function PATCH(req: NextRequest) {
  const csrfError = validateOrigin(req)
  if (csrfError) return csrfError

  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const role = buildRole(session.user.type, session.user.accessProfile)
  if (!can(role, "equipe.clockwork")) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  let body: ClockworkPatchBody
  try {
    const raw = await req.json()
    body = PatchBodySchema.parse(raw)
  } catch {
    return Response.json({ error: "Payload inválido." }, { status: 400 })
  }

  const token = await getClockworkApiTokenResolved().catch(() => "")
  if (!token) {
    return Response.json({ error: "CLOCKWORK_NOT_CONFIGURED" }, { status: 400 })
  }

  const { worklogId, started, timeSpentSeconds, comment } = body

  try {
    const res = await fetch(`${CW_HOST}/v1/worklogs/${worklogId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Token ${token.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        started,
        time_spent_seconds: timeSpentSeconds,
        comment,
      }),
      signal: AbortSignal.timeout(20_000),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => "")
      if (process.env.NODE_ENV !== "production") {
        console.error("[api/clockwork/worklogs PATCH]", res.status, text.slice(0, 400))
      }
      return Response.json(
        { error: `Clockwork retornou erro ${res.status}.` },
        { status: res.status >= 400 && res.status < 500 ? 422 : 502 },
      )
    }

    return Response.json({ ok: true })
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[api/clockwork/worklogs PATCH]", e)
    }
    return Response.json({ error: "Erro ao atualizar worklog no Clockwork." }, { status: 500 })
  }
}
