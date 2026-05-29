"use server"

/**
 * Server actions para time tracking do kanban via Clockwork Pro.
 *
 * Fluxo:
 *   card → "Em andamento"  → startCardTimer()  cria/retoma sessão na BD
 *   card ← "Em andamento"  → stopCardTimer()   calcula elapsed, posta worklog no Clockwork,
 *                                               salva accumulatedSeconds, anula startedAt
 *
 * A sessão persiste na BD (kanban_timer_sessions) enquanto o card estiver atribuído,
 * permitindo exibir o tempo acumulado ao retornar para "Em andamento".
 */

import { requireSession } from "@/core/session"
import { buildRole, can } from "@/core/rbac/policy"
import { db } from "@/core/db"
import { resolveJiraCredentialsForRequest } from "@/features/qa/lib/jira-credentials-db"
import { getClockworkApiTokenResolved } from "@/features/qa/lib/clockwork-credentials-db"
import { createClockworkWorklog } from "@/features/qa/lib/clockwork-worklogs-fetch"

// ─── Public types ─────────────────────────────────────────────────────────────

/** Estado do timer de um card, serializado para o cliente. */
export type TimerState = {
  issueKey: string
  /** Unix ms — início da sessão atual (null quando pausado). */
  startedAt: number | null
  /** Segundos acumulados de sessões anteriores encerradas. */
  accumulatedSeconds: number
}

// ─── Minimum session duration ─────────────────────────────────────────────────

/** Sessões com menos de 60 s não são postadas ao Clockwork para evitar ruído. */
const MIN_WORKLOG_SECONDS = 60

// ─── startCardTimer ───────────────────────────────────────────────────────────

/**
 * Inicia (ou retoma) o timer de um card que entrou em "Em andamento".
 * Idempotente: se já existe uma sessão ativa, não a sobrescreve.
 */
export async function startCardTimer(
  issueKey: string,
  summary: string | null,
): Promise<{ ok: boolean; error?: string; timer?: TimerState }> {
  const session = await requireSession()
  const role = buildRole(session.user.type, session.user.accessProfile)
  if (!can(role, "menu.kanban")) return { ok: false, error: "Acesso negado." }
  if (!issueKey?.trim()) return { ok: false, error: "issueKey inválido." }

  const userId = session.user.id
  const now = new Date()

  const existing = await db.kanbanTimerSession.findUnique({ where: { issueKey } })

  if (existing?.startedAt) {
    // Já está rodando — não reinicia (idempotente)
    console.info(`[timer] startCardTimer: sessão já ativa para ${issueKey}`)
    return {
      ok: true,
      timer: {
        issueKey,
        startedAt: existing.startedAt.getTime(),
        accumulatedSeconds: existing.accumulatedSeconds,
      },
    }
  }

  if (existing) {
    // Sessão existe mas estava pausada (startedAt = null) — retoma
    const updated = await db.kanbanTimerSession.update({
      where: { issueKey },
      data: { startedAt: now, summary: summary ?? existing.summary },
    })
    console.info(`[timer] startCardTimer: timer retomado para ${issueKey} (acumulado: ${updated.accumulatedSeconds}s)`)
    return {
      ok: true,
      timer: {
        issueKey,
        startedAt: now.getTime(),
        accumulatedSeconds: updated.accumulatedSeconds,
      },
    }
  }

  // Nova sessão
  const created = await db.kanbanTimerSession.create({
    data: { issueKey, userId, startedAt: now, accumulatedSeconds: 0, summary },
  })
  console.info(`[timer] startCardTimer: nova sessão iniciada para ${issueKey}`)
  return {
    ok: true,
    timer: {
      issueKey,
      startedAt: now.getTime(),
      accumulatedSeconds: created.accumulatedSeconds,
    },
  }
}

// ─── stopCardTimer ────────────────────────────────────────────────────────────

/**
 * Para o timer de um card que saiu de "Em andamento".
 * - Calcula o elapsed e soma ao accumulatedSeconds.
 * - Posta worklog no Clockwork (fire-and-forget; não bloqueia a resposta).
 * - Anula startedAt (sessão "pausada", preservando o acumulado para a próxima retomada).
 * Se não há sessão ativa, é no-op.
 */
export async function stopCardTimer(
  issueKey: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireSession()
  const role = buildRole(session.user.type, session.user.accessProfile)
  if (!can(role, "menu.kanban")) return { ok: false, error: "Acesso negado." }

  const timerSession = await db.kanbanTimerSession.findUnique({ where: { issueKey } })
  if (!timerSession?.startedAt) {
    // Sem sessão ativa — no-op
    return { ok: true }
  }

  const now = new Date()
  const elapsedSeconds = Math.round((now.getTime() - timerSession.startedAt.getTime()) / 1000)
  const newAccumulated = timerSession.accumulatedSeconds + elapsedSeconds

  // Pausa a sessão (preserva o acumulado para retomada futura)
  await db.kanbanTimerSession.update({
    where: { issueKey },
    data: { startedAt: null, accumulatedSeconds: newAccumulated },
  })

  console.info(
    `[timer] stopCardTimer: ${issueKey} — elapsed=${elapsedSeconds}s, total=${newAccumulated}s`,
  )

  if (elapsedSeconds >= MIN_WORKLOG_SECONDS) {
    // Post Clockwork em background — não bloqueia a resposta
    void _postToClockwork(
      timerSession.userId,
      issueKey,
      timerSession.startedAt,
      elapsedSeconds,
      timerSession.summary,
    )
  } else {
    console.info(`[timer] stopCardTimer: sessão muito curta (${elapsedSeconds}s < ${MIN_WORKLOG_SECONDS}s), pulando Clockwork`)
  }

  return { ok: true }
}

// ─── deleteCardTimer ──────────────────────────────────────────────────────────

/**
 * Remove completamente a sessão de timer de um card (chamado quando o card é
 * desatribuído, concluído ou cancelado definitivamente).
 * Se havia uma sessão ativa, para e posta o worklog antes de deletar.
 */
export async function deleteCardTimer(
  issueKey: string,
): Promise<void> {
  const timerSession = await db.kanbanTimerSession.findUnique({ where: { issueKey } }).catch(() => null)
  if (!timerSession) return

  if (timerSession.startedAt) {
    const elapsedSeconds = Math.round((Date.now() - timerSession.startedAt.getTime()) / 1000)
    if (elapsedSeconds >= MIN_WORKLOG_SECONDS) {
      void _postToClockwork(
        timerSession.userId,
        issueKey,
        timerSession.startedAt,
        elapsedSeconds,
        timerSession.summary,
      )
    }
  }

  await db.kanbanTimerSession.delete({ where: { issueKey } }).catch(() => null)
}

// ─── getActiveTimersForCards ──────────────────────────────────────────────────

/**
 * Retorna os estados de timer para as issues informadas.
 * Inclui apenas sessões existentes na BD (ativas ou pausadas).
 */
export async function getActiveTimersForCards(
  issueKeys: string[],
): Promise<TimerState[]> {
  const session = await requireSession()
  const role = buildRole(session.user.type, session.user.accessProfile)
  if (!can(role, "menu.kanban")) return []
  if (issueKeys.length === 0) return []

  const rows = await db.kanbanTimerSession.findMany({
    where: { issueKey: { in: issueKeys } },
    select: { issueKey: true, startedAt: true, accumulatedSeconds: true },
  })

  return rows.map((r) => ({
    issueKey: r.issueKey,
    startedAt: r.startedAt ? r.startedAt.getTime() : null,
    accumulatedSeconds: r.accumulatedSeconds,
  }))
}

// ─── Internal: post worklog to Clockwork ──────────────────────────────────────

async function _postToClockwork(
  userId: string,
  issueKey: string,
  startedAt: Date,
  timeSpentSeconds: number,
  summary: string | null,
): Promise<void> {
  try {
    const [token, creds] = await Promise.all([
      getClockworkApiTokenResolved().catch(() => null),
      resolveJiraCredentialsForRequest(userId).catch(() => null),
    ])

    if (!token) {
      console.warn(`[timer] _postToClockwork: token Clockwork não configurado — worklog não criado para ${issueKey}`)
      return
    }

    const comment = summary?.trim() ? `${issueKey}: ${summary.trim()}` : issueKey
    const authorEmail = creds?.jiraEmail ?? null

    await createClockworkWorklog({
      token,
      issueKey,
      startedAt: startedAt.toISOString(),
      timeSpentSeconds,
      comment,
      authorEmail,
    })
  } catch (err) {
    // Non-fatal: log only
    console.error(`[timer] _postToClockwork: erro inesperado para ${issueKey}:`, err)
  }
}
