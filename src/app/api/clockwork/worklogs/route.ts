import { auth } from "@/core/auth"
import { validateOrigin } from "@/core/security"
import { buildRole, can, manageableProfiles } from "@/core/rbac/policy"
import { getClockworkApiTokenResolved } from "@/features/qa/lib/clockwork-credentials-db"
import { fetchClockworkWorklogsForEmail } from "@/features/qa/lib/clockwork-worklogs-fetch"
import {
  getMgrJiraCredentials,
  resolveJiraCredentialsForRequest,
} from "@/features/qa/lib/jira-credentials-db"
import { getActiveQaUsers, resolveEmailForQaUserId } from "@/features/usuarios/actions/usuarios"
import { z } from "zod"
import type { NextRequest } from "next/server"

const CW_HOST = "https://api.clockwork.report"

// ── Helpers ───────────────────────────────────────────────────────────────────

type Period = "current" | "previous"

function monthRange(period: Period): { fromIso: string; toIso: string; monthLabel: string } {
  const now = new Date()
  const year = now.getUTCFullYear()
  const month = period === "previous" ? now.getUTCMonth() - 1 : now.getUTCMonth()
  const from = new Date(Date.UTC(year, month, 1))
  const to   = new Date(Date.UTC(year, month + 1, 0))
  const pad  = (n: number) => String(n).padStart(2, "0")
  const monthLabel = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).format(from)
  return {
    fromIso: `${from.getUTCFullYear()}-${pad(from.getUTCMonth() + 1)}-${pad(from.getUTCDate())}`,
    toIso:   `${to.getUTCFullYear()}-${pad(to.getUTCMonth() + 1)}-${pad(to.getUTCDate())}`,
    monthLabel,
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

  const periodParam = url.searchParams.get("period")
  const period: Period = periodParam === "previous" ? "previous" : "current"

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

  const { fromIso, toIso, monthLabel } = monthRange(period)

  try {
    const worklogs = await fetchClockworkWorklogsForEmail({
      token,
      emailNorm: targetEmail.trim().toLowerCase(),
      fromIso,
      toIso,
      timeZoneId: "America/Sao_Paulo",
    })

    // DEBUG — log raw IDs so we can verify the correct field for DELETE
    // TODO: remove after confirming correct ID format
    if (worklogs.length > 0) {
      console.log("[api/clockwork/worklogs GET] sample worklog id:", worklogs[0].id, "| raw prefix check:", worklogs[0].id.startsWith("cw-") ? "has cw- prefix" : "no cw- prefix")
    }

    // Normalise: strip the "cw-" prefix from IDs so the client has the raw Clockwork ID
    const items = worklogs.map((w) => ({
      id: w.id.startsWith("cw-") ? w.id.slice(3) : w.id,
      issueKey: w.issueKey,
      summary: w.summary,
      started: w.started,
      timeSpentSeconds: w.timeSpentSeconds,
      comment: w.comment,
    }))

    return Response.json({ worklogs: items, month: monthLabel, fromIso, toIso })
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[api/clockwork/worklogs GET]", e)
    }
    return Response.json({ error: "Erro ao buscar worklogs do Clockwork." }, { status: 500 })
  }
}

// ── DELETE — remove um worklog específico (Jira API primário, Clockwork fallback) ─

const DeleteBodySchema = z.object({
  worklogId: z.string().min(1),
  /** Chave da issue Jira (ex: "PROJ-123"). Quando presente, tenta Jira API primeiro. */
  issueKey: z.string().min(1).optional(),
})

export async function DELETE(req: NextRequest) {
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

  let body: z.infer<typeof DeleteBodySchema>
  try {
    const raw = await req.json()
    body = DeleteBodySchema.parse(raw)
  } catch {
    return Response.json({ error: "Payload inválido." }, { status: 400 })
  }

  // ── Primary: Jira REST API ─────────────────────────────────────────────────
  // O Clockwork Pro é uma app Jira — os worklogs são registos Jira.
  // O endpoint DELETE do Clockwork não está documentado; a remoção canónica
  // usa a Jira Cloud REST API: DELETE /rest/api/3/issue/{key}/worklog/{id}.
  if (body.issueKey) {
    const jiraCreds = await resolveJiraCredentialsForRequest(session.user.id)
      ?? await getMgrJiraCredentials()

    if (jiraCreds) {
      const jiraBase  = jiraCreds.jiraUrl.replace(/\/$/, "")
      const basicCred = Buffer.from(`${jiraCreds.jiraEmail}:${jiraCreds.apiToken}`).toString("base64")
      const jiraUrl   = `${jiraBase}/rest/api/3/issue/${encodeURIComponent(body.issueKey)}/worklog/${encodeURIComponent(body.worklogId)}`

      try {
        const jiraRes = await fetch(jiraUrl, {
          method: "DELETE",
          headers: { Authorization: `Basic ${basicCred}`, Accept: "application/json" },
          signal: AbortSignal.timeout(20_000),
        })

        // 204 No Content = sucesso canónico do Jira para DELETE worklog
        if (jiraRes.ok || jiraRes.status === 204) {
          return Response.json({ ok: true })
        }

        // Erros de autenticação: retorna imediatamente sem tentar Clockwork
        if (jiraRes.status === 401 || jiraRes.status === 403) {
          const text = await jiraRes.text().catch(() => "")
          console.error("[api/clockwork/worklogs DELETE via Jira] auth error", {
            worklogId: body.worklogId, issueKey: body.issueKey,
            jiraStatus: jiraRes.status, body: text.slice(0, 300),
          })
          return Response.json(
            { error: `Sem permissão para remover o worklog no Jira (HTTP ${jiraRes.status}).` },
            { status: 422 },
          )
        }

        // Para 404 e outros: regista e cai no fallback Clockwork
        const text = await jiraRes.text().catch(() => "")
        console.warn("[api/clockwork/worklogs DELETE via Jira] tentando fallback Clockwork", {
          worklogId: body.worklogId, issueKey: body.issueKey,
          jiraStatus: jiraRes.status, jiraBody: text.slice(0, 300),
        })
      } catch (e) {
        console.error("[api/clockwork/worklogs DELETE via Jira] network error, tentando Clockwork", e)
      }
    }
  }

  // ── Fallback: Clockwork API ─────────────────────────────────────────────────
  const token = await getClockworkApiTokenResolved().catch(() => "")
  if (!token) {
    return Response.json({ error: "CLOCKWORK_NOT_CONFIGURED" }, { status: 400 })
  }

  const cwUrl = `${CW_HOST}/v1/worklogs/${encodeURIComponent(body.worklogId)}`

  try {
    const res = await fetch(cwUrl, {
      method: "DELETE",
      headers: {
        Authorization: `Token ${token.trim()}`,
        Accept:        "application/json",
      },
      signal: AbortSignal.timeout(20_000),
    })

    // 204 No Content é resposta válida de sucesso para DELETE
    if (res.ok) {
      return Response.json({ ok: true })
    }

    const text = await res.text().catch(() => "")
    console.error("[api/clockwork/worklogs DELETE]", {
      worklogId: body.worklogId,
      cwUrl,
      cwStatus: res.status,
      cwBody: text.slice(0, 400),
    })

    return Response.json(
      { error: `Clockwork retornou HTTP ${res.status}. Detalhes: ${text.slice(0, 200) || "(sem corpo)"}` },
      { status: res.status >= 400 && res.status < 500 ? 422 : 502 },
    )
  } catch (e) {
    console.error("[api/clockwork/worklogs DELETE] network error", e)
    return Response.json({ error: "Erro de rede ao remover worklog no Clockwork." }, { status: 500 })
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
        timeSpentSeconds,   // camelCase — matches Clockwork Pro API (same as GET response and POST)
        comment,
      }),
      signal: AbortSignal.timeout(20_000),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => "")
      console.error("[api/clockwork/worklogs PATCH]", { worklogId, cwStatus: res.status, cwBody: text.slice(0, 400) })
      return Response.json(
        { error: `Clockwork retornou erro ${res.status}. Detalhes: ${text.slice(0, 200) || "(sem corpo)"}` },
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
