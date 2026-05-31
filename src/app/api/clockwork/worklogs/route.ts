import { auth } from "@/core/auth"
import { validateOrigin } from "@/core/security"
import { buildRole, can } from "@/core/rbac/policy"
import { getClockworkApiTokenResolved } from "@/features/qa/lib/clockwork-credentials-db"
import { fetchClockworkWorklogsForEmail } from "@/features/qa/lib/clockwork-worklogs-fetch"
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

  let targetEmail: string | null
  try {
    targetEmail = await resolveEmailForQaUserId(requestedUserId)
  } catch (e) {
    console.error("[api/clockwork/worklogs GET] resolveEmailForQaUserId exception", e)
    return Response.json({ error: "Erro interno ao resolver utilizador." }, { status: 500 })
  }
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
      // ?overrideEditableFlag=true permite que admins Jira excluam worklogs de outros membros
      const jiraUrl   = `${jiraBase}/rest/api/3/issue/${encodeURIComponent(body.issueKey)}/worklog/${encodeURIComponent(body.worklogId)}?overrideEditableFlag=true`

      try {
        const jiraRes = await fetch(jiraUrl, {
          method: "DELETE",
          headers: { Authorization: `Basic ${basicCred}`, Accept: "application/json" },
          signal: AbortSignal.timeout(15_000),
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

// ── PATCH — atualiza um worklog específico via Jira REST API ─────────────────
//
// A API Clockwork Pro (api.clockwork.report) é somente leitura — POST /v1/worklogs
// retorna 404. A única forma de editar é via Jira PUT /issue/{key}/worklog/{id}.
//
// O worklogId vindo do Clockwork já é o ID numérico do Jira — não há necessidade
// de resolução extra. O que falhava antes era o uso de credenciais sem permissão.
//
// Credencial usada em ordem de prioridade:
//   1. Credencial do dono do worklog (pode editar o próprio)
//   2. Credencial do utilizador da sessão (MGR com acesso ao projeto)
//   3. Primeira credencial de MGR no BD
//   4. Adicionado ?overrideEditableFlag=true para que admins Jira editem qualquer worklog

const PatchBodySchema = z.object({
  worklogId: z.string().min(1),
  /** Chave da issue Jira (ex: "UX-967"). Obrigatório para editar via Jira API. */
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

  if (!issueKey) {
    return Response.json({ error: "issueKey é obrigatório para editar worklogs do Clockwork." }, { status: 400 })
  }

  // ── Jira REST API PUT ─────────────────────────────────────────────────────
  // O worklogId do Clockwork já é o ID numérico do Jira (os IDs são os mesmos).
  // Tenta credenciais em ordem: dono → sessão → MGR global.
  // Adiciona ?overrideEditableFlag=true para que admins Jira possam editar
  // worklogs de outros membros sem precisar de permissão explícita por worklog.

  const ownerCreds =
    body.userId && body.userId !== session.user.id
      ? await resolveJiraCredentialsForRequest(body.userId)
      : null
  const jiraCreds = ownerCreds
    ?? await resolveJiraCredentialsForRequest(session.user.id, session.user.email ?? "")
    ?? await getMgrJiraCredentials()

  if (!jiraCreds) {
    return Response.json(
      { error: "Credenciais Jira não configuradas. Configure seu token Jira em Configurações para editar worklogs." },
      { status: 422 },
    )
  }

  const jiraBase  = jiraCreds.jiraUrl.replace(/\/$/, "")
  const basicCred = Buffer.from(`${jiraCreds.jiraEmail}:${jiraCreds.apiToken}`).toString("base64")

  // ?overrideEditableFlag=true: permite que admins Jira editem worklogs de outros
  const jiraUrl = `${jiraBase}/rest/api/3/issue/${encodeURIComponent(issueKey)}/worklog/${encodeURIComponent(worklogId)}?overrideEditableFlag=true&notifyUsers=false`

  // Jira Cloud v3: started usa offset +0000, não Z
  const jiraStarted = started.replace(/Z$/, "+0000")
  // Jira Cloud v3: comment em ADF
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
      signal: AbortSignal.timeout(15_000),
    })

    if (jiraRes.ok) {
      return Response.json({ ok: true })
    }

    const text = await jiraRes.text().catch(() => "")

    // 403/401 — credenciais insuficientes
    if (jiraRes.status === 401 || jiraRes.status === 403) {
      console.error("[api/clockwork/worklogs PATCH] Jira auth error", {
        worklogId, issueKey, status: jiraRes.status, body: text.slice(0, 200),
        credEmail: jiraCreds.jiraEmail,
      })
      return Response.json(
        { error: `Sem permissão para editar este worklog no Jira (HTTP ${jiraRes.status}). Verifique se as credenciais têm acesso de escrita ao projeto ${issueKey.split("-")[0]}.` },
        { status: 422 },
      )
    }

    // 404 — worklog não encontrado com o ID do Clockwork
    if (jiraRes.status === 404) {
      console.error("[api/clockwork/worklogs PATCH] Jira 404 — worklog ID do Clockwork pode diferir do Jira", {
        worklogId, issueKey, body: text.slice(0, 200),
      })
      return Response.json(
        { error: `Worklog não encontrado no Jira (ID: ${worklogId}). O registro pode ter sido excluído ou o ID do Clockwork não corresponde ao Jira.` },
        { status: 422 },
      )
    }

    // Outros erros Jira
    console.error("[api/clockwork/worklogs PATCH] Jira error", {
      worklogId, issueKey, status: jiraRes.status, body: text.slice(0, 200),
    })
    return Response.json(
      { error: `Erro ao editar worklog no Jira (HTTP ${jiraRes.status}).`, detail: text.slice(0, 200) },
      { status: 502 },
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[api/clockwork/worklogs PATCH] network error", { worklogId, issueKey, error: msg })
    return Response.json({ error: "Erro de rede ao contactar o Jira.", detail: msg }, { status: 502 })
  }
}
