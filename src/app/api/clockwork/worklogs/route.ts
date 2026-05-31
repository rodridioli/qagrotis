import { auth } from "@/core/auth"
import { validateOrigin } from "@/core/security"
import { buildRole, can } from "@/core/rbac/policy"
import { getClockworkApiTokenResolved } from "@/features/qa/lib/clockwork-credentials-db"
import { fetchClockworkWorklogsForEmail } from "@/features/qa/lib/clockwork-worklogs-fetch"
import {
  getAllMgrJiraCredentialSets,
  getUserAllJiraCredentials,
  resolveJiraCredentialsForRequest,
  type StoredJiraCredentials,
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

/**
 * Monta a lista ordenada de credenciais Jira a tentar, deduplicada por jiraUrl.
 * Ordem: [ownerCreds, sessionCreds, ...todos os MGRs com instâncias distintas]
 * Permite suporte a múltiplas instâncias Jira (ex: agrotis + agrosem) sem hardcode.
 */
/**
 * Monta a lista ordenada de credenciais Jira a tentar, deduplicada por jiraUrl.
 * Ordem: [todas do dono, todas da sessão, todas as instâncias de todos os MGRs]
 * Com o schema de chave composta (userId, jiraUrl), um MGR pode ter N instâncias
 * configuradas — todas são incluídas automaticamente.
 */
async function buildJiraCredentialList(opts: {
  ownerUserId?: string
  sessionUserId: string
  sessionEmail: string
}): Promise<StoredJiraCredentials[]> {
  const { ownerUserId, sessionUserId, sessionEmail } = opts

  const [ownerAllCreds, sessionAllCreds, allMgrCreds] = await Promise.all([
    ownerUserId ? getUserAllJiraCredentials(ownerUserId) : Promise.resolve([] as StoredJiraCredentials[]),
    getUserAllJiraCredentials(sessionUserId),
    getAllMgrJiraCredentialSets(),
  ])

  // Fallback legacy cookie para a sessão (sistema pré-migração)
  const legacyCookieCreds = await resolveJiraCredentialsForRequest(sessionUserId, sessionEmail)

  const seen = new Set<string>()
  const list: StoredJiraCredentials[] = []

  function push(c: StoredJiraCredentials | null | undefined) {
    if (!c) return
    const key = c.jiraUrl.trim().toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    list.push(c)
  }

  for (const c of ownerAllCreds) push(c)
  for (const c of sessionAllCreds) push(c)
  push(legacyCookieCreds) // cookie legacy caso sessionAllCreds esteja vazio
  for (const c of allMgrCreds) push(c)

  return list
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

// ── DELETE — remove worklog (itera todas as instâncias Jira, fallback Clockwork) ─

const DeleteBodySchema = z.object({
  worklogId: z.string().min(1),
  /** Chave da issue Jira (ex: "PROJ-123"). Quando presente, tenta Jira API primeiro. */
  issueKey: z.string().min(1).optional(),
  /** userId do dono do worklog. Credenciais do dono são tentadas primeiro. */
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

  // ── Primary: itera todas as instâncias Jira conhecidas ───────────────────────
  if (body.issueKey) {
    const credList = await buildJiraCredentialList({
      ownerUserId: body.userId && body.userId !== session.user.id ? body.userId : undefined,
      sessionUserId: session.user.id,
      sessionEmail: session.user.email ?? "",
    })

    const jiraPath = `/rest/api/3/issue/${encodeURIComponent(body.issueKey)}/worklog/${encodeURIComponent(body.worklogId)}?overrideEditableFlag=true`
    const attempts: { jiraUrl: string; status: number }[] = []

    for (const creds of credList) {
      const jiraBase  = creds.jiraUrl.replace(/\/$/, "")
      const basicCred = Buffer.from(`${creds.jiraEmail}:${creds.apiToken}`).toString("base64")
      const fullUrl   = `${jiraBase}${jiraPath}`

      try {
        const jiraRes = await fetch(fullUrl, {
          method: "DELETE",
          headers: { Authorization: `Basic ${basicCred}`, Accept: "application/json" },
          signal: AbortSignal.timeout(15_000),
        })

        // 204 / 200 = sucesso canónico do Jira para DELETE worklog
        if (jiraRes.ok || jiraRes.status === 204) {
          return Response.json({ ok: true })
        }

        const text = await jiraRes.text().catch(() => "")
        attempts.push({ jiraUrl: jiraBase, status: jiraRes.status })

        if (jiraRes.status === 401 || jiraRes.status === 403) {
          console.warn("[api/clockwork/worklogs DELETE] auth error, tentando próxima instância", {
            jiraBase, worklogId: body.worklogId, issueKey: body.issueKey, status: jiraRes.status,
          })
          continue
        }

        if (jiraRes.status === 404) {
          console.warn("[api/clockwork/worklogs DELETE] 404 na instância, tentando próxima", {
            jiraBase, worklogId: body.worklogId, issueKey: body.issueKey,
          })
          continue
        }

        console.error("[api/clockwork/worklogs DELETE] erro Jira", {
          jiraBase, worklogId: body.worklogId, issueKey: body.issueKey,
          status: jiraRes.status, body: text.slice(0, 200),
        })
        continue
      } catch (e) {
        console.error("[api/clockwork/worklogs DELETE] network error", {
          jiraBase, worklogId: body.worklogId, error: e,
        })
        attempts.push({ jiraUrl: jiraBase, status: 0 })
        continue
      }
    }

    // Todas as instâncias Jira falharam — log e cai no fallback Clockwork
    if (attempts.length > 0) {
      console.warn("[api/clockwork/worklogs DELETE] todas as instâncias Jira falharam, tentando Clockwork", {
        worklogId: body.worklogId, issueKey: body.issueKey,
        attempts: attempts.map((a) => `${a.jiraUrl} → ${a.status}`),
      })
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

    if (res.ok) {
      return Response.json({ ok: true })
    }

    const text = await res.text().catch(() => "")
    console.error("[api/clockwork/worklogs DELETE] Clockwork fallback error", {
      worklogId: body.worklogId, cwUrl, cwStatus: res.status, cwBody: text.slice(0, 400),
    })

    return Response.json(
      { error: `Clockwork retornou HTTP ${res.status}. Detalhes: ${text.slice(0, 200) || "(sem corpo)"}` },
      { status: res.status >= 400 && res.status < 500 ? 422 : 502 },
    )
  } catch (e) {
    console.error("[api/clockwork/worklogs DELETE] Clockwork network error", e)
    return Response.json({ error: "Erro de rede ao remover worklog no Clockwork." }, { status: 500 })
  }
}

// ── PATCH — atualiza worklog (itera todas as instâncias Jira conhecidas) ──────
//
// Estratégia: monta lista ordenada de credenciais [dono → sessão → todos MGRs],
// deduplicada por jiraUrl. Para cada instância, tenta PUT. Retorna ok no primeiro
// 200. Se 401/403/404 → descarta e tenta a próxima. Após esgotar todas → 422
// com lista de instâncias tentadas para debug.

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

  // ── Monta lista de credenciais deduplicada por instância Jira ────────────────
  const credList = await buildJiraCredentialList({
    ownerUserId: body.userId && body.userId !== session.user.id ? body.userId : undefined,
    sessionUserId: session.user.id,
    sessionEmail: session.user.email ?? "",
  })

  if (credList.length === 0) {
    return Response.json(
      { error: "Credenciais Jira não configuradas. Configure seu token Jira em Configurações para editar worklogs." },
      { status: 422 },
    )
  }

  // Jira Cloud v3: started usa offset +0000 (não Z); comment em ADF
  const jiraStarted = started.replace(/Z$/, "+0000")
  const jiraComment = comment?.trim()
    ? {
        version: 1,
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: comment.trim() }] }],
      }
    : undefined

  const jiraPath = `/rest/api/3/issue/${encodeURIComponent(issueKey)}/worklog/${encodeURIComponent(worklogId)}?notifyUsers=false`
  const attempts: { jiraUrl: string; status: number }[] = []

  // ── Itera sobre todas as instâncias Jira ─────────────────────────────────────
  for (const creds of credList) {
    const jiraBase  = creds.jiraUrl.replace(/\/$/, "")
    const basicCred = Buffer.from(`${creds.jiraEmail}:${creds.apiToken}`).toString("base64")
    const fullUrl   = `${jiraBase}${jiraPath}`

    try {
      const jiraRes = await fetch(fullUrl, {
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
      attempts.push({ jiraUrl: jiraBase, status: jiraRes.status })

      // 401/403 — sem permissão nesta instância → tenta a próxima
      if (jiraRes.status === 401 || jiraRes.status === 403) {
        console.warn("[api/clockwork/worklogs PATCH] auth error, tentando próxima instância", {
          jiraBase, worklogId, issueKey, status: jiraRes.status,
        })
        continue
      }

      // 404 — projeto não existe nesta instância → tenta a próxima
      if (jiraRes.status === 404) {
        console.warn("[api/clockwork/worklogs PATCH] 404 na instância, tentando próxima", {
          jiraBase, worklogId, issueKey,
        })
        continue
      }

      // Outros erros (400, 5xx) — loga e tenta a próxima
      console.error("[api/clockwork/worklogs PATCH] erro Jira", {
        jiraBase, worklogId, issueKey, status: jiraRes.status, body: text.slice(0, 200),
      })
      continue
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error("[api/clockwork/worklogs PATCH] network error", { jiraBase, worklogId, issueKey, error: msg })
      attempts.push({ jiraUrl: jiraBase, status: 0 })
      continue
    }
  }

  // ── Todas as instâncias falharam ─────────────────────────────────────────────
  const detail = attempts
    .map((a) => `${a.jiraUrl} → HTTP ${a.status || "network error"}`)
    .join("; ")

  console.error("[api/clockwork/worklogs PATCH] todas as instâncias falharam", {
    worklogId, issueKey, attempts,
  })

  return Response.json(
    {
      error: `Nenhuma instância Jira conseguiu editar o worklog (${issueKey}). Verifique as credenciais configuradas.`,
      detail,
    },
    { status: 422 },
  )
}
