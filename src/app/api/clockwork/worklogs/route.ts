import { auth } from "@/core/auth"
import { validateOrigin } from "@/core/security"
import { buildRole, can } from "@/core/rbac/policy"
import { getClockworkApiTokenResolved } from "@/features/qa/lib/clockwork-credentials-db"
import { fetchClockworkWorklogsForEmail, createClockworkWorklog } from "@/features/qa/lib/clockwork-worklogs-fetch"
import {
  getMgrJiraCredentials,
  resolveJiraCredentialsForRequest,
} from "@/features/qa/lib/jira-credentials-db"
import { resolveEmailForQaUserId } from "@/features/usuarios/actions/usuarios"
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
  const raw = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).format(from)
  const monthLabel = raw.charAt(0).toUpperCase() + raw.slice(1)
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

  // Apenas Administrador:MGR (individual.viewOthers) pode consultar worklogs de outros utilizadores.
  if (requestedUserId !== session.user.id && !can(role, "individual.viewOthers")) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
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
  /** userId do dono do worklog. Quando diferente do utilizador da sessão, as credenciais
   *  do dono são tentadas primeiro — necessário quando MGR exclui worklog de outro membro. */
  userId: z.string().min(1).optional(),
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
    // Tenta credenciais do dono do worklog primeiro (quando MGR exclui worklog de outro membro,
    // a conta Jira do MGR pode não ter acesso ao projeto e o Jira retorna 404 silencioso).
    const ownerCreds =
      body.userId && body.userId !== session.user.id
        ? await resolveJiraCredentialsForRequest(body.userId)
        : null
    const jiraCreds = ownerCreds
      ?? await resolveJiraCredentialsForRequest(session.user.id, session.user.email ?? "")
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

// ── PATCH — atualiza um worklog específico ────────────────────────────────────
//
// Estratégia:
//   1. Primário  — Jira REST API PUT (quando issueKey disponível)
//   2. Fallback  — Clockwork delete + recreate
//      (A Clockwork API não expõe PATCH /v1/worklogs/{id} — retorna 404 HTML)

const PatchBodySchema = z.object({
  worklogId: z.string().min(1),
  /** Chave da issue Jira (ex: "UX-967"). Quando presente, usa Jira API como primário. */
  issueKey: z.string().min(1).optional(),
  started: z.string().min(1),           // ISO datetime (ex: "2026-05-28T09:00:00.000Z")
  timeSpentSeconds: z.number().int().positive(),
  comment: z.string().max(2000),
  /** userId do dono do worklog. Necessário quando MGR edita worklog de outro membro. */
  userId: z.string().min(1).optional(),
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

  const { worklogId, issueKey, started, timeSpentSeconds, comment } = body

  // ── Primário: Jira REST API ───────────────────────────────────────────────
  if (issueKey) {
    const jiraCreds = await resolveJiraCredentialsForRequest(session.user.id, session.user.email ?? "")
      ?? await getMgrJiraCredentials()

    if (jiraCreds) {
      const jiraBase  = jiraCreds.jiraUrl.replace(/\/$/, "")
      const basicCred = Buffer.from(`${jiraCreds.jiraEmail}:${jiraCreds.apiToken}`).toString("base64")
      const jiraUrl   = `${jiraBase}/rest/api/3/issue/${encodeURIComponent(issueKey)}/worklog/${encodeURIComponent(worklogId)}`

      // Jira Cloud v3: started deve usar offset explícito (+0000), não Z
      const jiraStarted = started.replace(/Z$/, "+0000")
      // Jira Cloud v3: comment deve ser ADF, não string plana
      const jiraComment = comment?.trim()
        ? {
            version: 1,
            type: "doc",
            content: [{ type: "paragraph", content: [{ type: "text", text: comment.trim() }] }],
          }
        : undefined

      try {
        const jiraRes = await fetch(jiraUrl, {
          method: "PUT",
          headers: {
            Authorization: `Basic ${basicCred}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            started: jiraStarted,
            timeSpentSeconds,
            ...(jiraComment ? { comment: jiraComment } : {}),
          }),
          signal: AbortSignal.timeout(20_000),
        })

        if (jiraRes.ok) {
          return Response.json({ ok: true })
        }

        // Erros de autenticação: retorna imediatamente
        if (jiraRes.status === 401 || jiraRes.status === 403) {
          const text = await jiraRes.text().catch(() => "")
          console.error("[api/clockwork/worklogs PATCH via Jira] auth error", {
            worklogId, issueKey, jiraStatus: jiraRes.status, body: text.slice(0, 300),
          })
          return Response.json(
            { error: `Sem permissão para editar o worklog no Jira (HTTP ${jiraRes.status}).` },
            { status: 422 },
          )
        }

        const text = await jiraRes.text().catch(() => "")
        console.warn("[api/clockwork/worklogs PATCH via Jira] falhou, tentando fallback Clockwork", {
          worklogId, issueKey, jiraStatus: jiraRes.status, jiraBody: text.slice(0, 300),
        })
        // fall through to Clockwork fallback
      } catch (e) {
        console.error("[api/clockwork/worklogs PATCH via Jira] network error, tentando Clockwork", e)
        // fall through to Clockwork fallback
      }
    }
  }

  // ── Fallback: Clockwork delete + recreate ─────────────────────────────────────
  // A Clockwork API não expõe PATCH — a estratégia é DELETE + POST.
  // Usado quando: Jira retorna 400/404/5xx (ex: issue de outro projeto Jira)
  // ou quando credenciais Jira não estão configuradas.
  if (!issueKey) {
    return Response.json({ error: "Credenciais Jira não configuradas e issueKey ausente." }, { status: 400 })
  }

  const cwToken = await getClockworkApiTokenResolved().catch(() => "")
  if (!cwToken) {
    return Response.json({ error: "Credenciais Jira não configuradas e Clockwork não disponível." }, { status: 400 })
  }

  // 1. Remove o worklog antigo do Clockwork
  const cwDeleteUrl = `${CW_HOST}/v1/worklogs/${encodeURIComponent(worklogId)}`
  try {
    const cwDelRes = await fetch(cwDeleteUrl, {
      method: "DELETE",
      headers: { Authorization: `Token ${cwToken.trim()}`, Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    })
    // 204/200 = sucesso; 404 = já foi removido — ambos aceitáveis
    if (!cwDelRes.ok && cwDelRes.status !== 404) {
      const errText = await cwDelRes.text().catch(() => "")
      console.error("[api/clockwork/worklogs PATCH fallback DELETE]", {
        worklogId, cwStatus: cwDelRes.status, cwBody: errText.slice(0, 200),
      })
      return Response.json(
        { error: `Clockwork retornou HTTP ${cwDelRes.status} ao remover worklog.` },
        { status: 502 },
      )
    }
  } catch (e) {
    console.error("[api/clockwork/worklogs PATCH fallback DELETE] network error", e)
    return Response.json({ error: "Erro de rede ao remover worklog no Clockwork." }, { status: 502 })
  }

  // 2. Recria o worklog com os valores atualizados
  // Usa o userId do body (quando MGR edita worklog de outro membro) ou o da sessão.
  const targetUserId = body.userId ?? session.user.id
  const targetEmail = await resolveEmailForQaUserId(targetUserId).catch(() => null)
  const createResult = await createClockworkWorklog({
    token: cwToken,
    issueKey,
    startedAt: started,
    timeSpentSeconds,
    comment: comment || null,
    authorEmail: targetEmail ?? session.user.email ?? null,
  })

  if (createResult.ok) return Response.json({ ok: true })

  console.error("[api/clockwork/worklogs PATCH fallback CREATE] falhou", {
    worklogId, issueKey, error: createResult.error,
  })
  return Response.json(
    { error: `Não foi possível salvar o registro (${createResult.error ?? "erro no Clockwork"}).` },
    { status: 502 },
  )
}
