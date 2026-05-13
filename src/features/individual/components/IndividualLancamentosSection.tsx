"use client"

import * as React from "react"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/shared/EmptyState"
import { SectionSpinner } from "@/components/shared/SectionSpinner"
import { cn } from "@/core/utils"
import {
  getLancamentosPresetRange,
  toIsoLocal,
  type LancamentosPeriodPreset,
} from "@/features/individual/lib/individual-lancamentos-date-presets"

export interface IndividualLancamentosSectionProps {
  evaluatedUserId: string
}

type LancamentoRow = {
  id: string
  issueKey: string
  summary: string | null
  started: string
  timeSpentSeconds: number
  hours: number
  isLongSession: boolean
  comment: string | null
  dataSource?: "jira" | "clockwork"
}

type ApiOk = {
  source: "jira"
  entries: LancamentoRow[]
  totalSeconds: number
  longSessionCount: number
  truncatedIssues: boolean
  truncatedWorklogs: boolean
  noJiraUser: boolean
  jiraBrowseBase?: string
  message?: string
  jiraAuthorDisplayName?: string | null
  includesClockwork?: boolean
  clockworkMergedCount?: number
}

function formatTotalDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  if (h === 0) return `${m} min`
  if (m === 0) return `${h} h`
  return `${h} h ${m} min`
}

function formatHoursShort(hours: number): string {
  if (hours === Math.floor(hours)) return `${hours} h`
  return `${hours.toFixed(2)} h`
}

export function IndividualLancamentosSection({ evaluatedUserId }: IndividualLancamentosSectionProps) {
  const [preset, setPreset] = React.useState<LancamentosPeriodPreset | null>("week")
  const [from, setFrom] = React.useState(() => getLancamentosPresetRange("week").from)
  const [to, setTo] = React.useState(() => getLancamentosPresetRange("week").to)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [data, setData] = React.useState<ApiOk | null>(null)
  const [jiraBase, setJiraBase] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    fetch("/api/jira/credentials", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { jiraUrl?: string } | null) => {
        if (cancelled || !d?.jiraUrl?.trim()) return
        setJiraBase((prev) => prev ?? String(d.jiraUrl).replace(/\/$/, ""))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    const qs = new URLSearchParams({
      from,
      to,
      userId: evaluatedUserId,
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    })
    try {
      const res = await fetch(`/api/jira/lancamentos?${qs}`, { credentials: "same-origin" })
      const body = (await res.json().catch(() => null)) as ApiOk | { error?: string } | null
      if (!res.ok) {
        const msg =
          typeof body === "object" && body && "error" in body && typeof body.error === "string"
            ? body.error
            : "Não foi possível carregar os lançamentos."
        throw new Error(msg)
      }
      const ok = body as ApiOk
      setData(ok)
      if (ok.jiraBrowseBase?.trim()) {
        setJiraBase(ok.jiraBrowseBase.replace(/\/$/, ""))
      }
    } catch (e) {
      setData(null)
      setError(e instanceof Error ? e.message : "Erro ao carregar.")
    } finally {
      setLoading(false)
    }
  }, [evaluatedUserId, from, to])

  React.useEffect(() => {
    void load()
  }, [load])

  function applyPreset(p: LancamentosPeriodPreset) {
    const r = getLancamentosPresetRange(p)
    setPreset(p)
    setFrom(r.from)
    setTo(r.to)
  }

  function onFromInput(v: string) {
    setPreset(null)
    setFrom(v)
  }

  function onToInput(v: string) {
    setPreset(null)
    setTo(v)
  }

  const todayIso = React.useMemo(() => toIsoLocal(new Date()), [])

  return (
    <div className="flex w-full flex-col gap-6">
      <p className="text-xs leading-relaxed text-text-secondary">
        Por defeito listamos <strong className="font-medium text-text-primary">worklogs nativos do Jira</strong> (Work
        log da issue). Se o tempo existir só no Clockwork (Pro), um administrador MGR pode configurar o token em{" "}
        <strong className="font-medium text-text-primary">Configurações → Integração Clockwork</strong>; opcionalmente
        pode existir <strong className="font-medium text-text-primary">CLOCKWORK_API_TOKEN</strong> no servidor como
        reserva. Esses lançamentos são fundidos aqui e assinalados como Clockwork. Ajuste o intervalo para incluir o dia
        do registo.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["today", "Hoje"],
              ["week", "Semana"],
              ["month", "Mês"],
              ["lastMonth", "Último mês"],
            ] as const
          ).map(([key, label]) => (
            <Button
              key={key}
              type="button"
              variant={preset === key ? "default" : "outline"}
              size="sm"
              onClick={() => applyPreset(key)}
            >
              {label}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <span className="whitespace-nowrap">De</span>
            <input
              type="date"
              value={from}
              max={to}
              onChange={(e) => onFromInput(e.target.value)}
              className="rounded-md border border-border-default bg-surface-card px-2 py-1.5 text-sm text-text-primary"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <span className="whitespace-nowrap">Até</span>
            <input
              type="date"
              value={to}
              min={from}
              max={todayIso}
              onChange={(e) => onToInput(e.target.value)}
              className="rounded-md border border-border-default bg-surface-card px-2 py-1.5 text-sm text-text-primary"
            />
          </label>
          <Button type="button" variant="secondary" size="sm" onClick={() => void load()}>
            Atualizar
          </Button>
        </div>
      </div>

      {loading ? (
        <SectionSpinner label="A carregar lançamentos…" />
      ) : error ? (
        <EmptyState message={`Erro: ${error}`} />
      ) : data?.noJiraUser && !data.entries.length ? (
        <EmptyState
          message={
            data.message ??
            "Não foi encontrado utilizador Jira com o mesmo e-mail deste cadastro."
          }
        />
      ) : (
        <>
          {data?.noJiraUser && data.entries.length > 0 ? (
            <div
              className="rounded-lg border border-border-default bg-surface-card px-4 py-3 text-sm text-text-secondary"
              role="status"
            >
              <p className="font-medium text-text-primary">Utilizador Jira não encontrado por e-mail</p>
              <p className="mt-1">
                A tabela pode mostrar apenas lançamentos vindos da API Clockwork (token no servidor). Associe o mesmo
                e-mail no Jira para alinhar worklogs nativos.
              </p>
            </div>
          ) : null}
          {data && data.longSessionCount > 0 ? (
            <div
              className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-text-primary"
              role="status"
            >
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" aria-hidden />
              <div>
                <p className="font-medium text-amber-900 dark:text-amber-100">
                  {data.longSessionCount === 1
                    ? "Existe 1 lançamento com mais de 8 horas."
                    : `Existem ${data.longSessionCount} lançamentos com mais de 8 horas.`}
                </p>
                <p className="mt-1 text-text-secondary">
                  Estas linhas estão destacadas na tabela. Revise se o tempo foi registado corretamente.
                </p>
              </div>
            </div>
          ) : null}

          {data && (data.truncatedIssues || data.truncatedWorklogs) ? (
            <p className="text-sm text-text-secondary">
              {data.truncatedIssues
                ? "Lista de issues truncada (limite do servidor). Reduza o intervalo para ver mais."
                : null}
              {data.truncatedIssues && data.truncatedWorklogs ? " " : ""}
              {data.truncatedWorklogs
                ? "Lista de lançamentos truncada (limite do servidor). Reduza o intervalo."
                : null}
            </p>
          ) : null}

          <div className="rounded-custom border border-border-default bg-surface-card p-4 shadow-card">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
              <p className="text-sm text-text-secondary">Total no período</p>
              <p className="text-2xl font-semibold tabular-nums text-text-primary">
                {data ? formatTotalDuration(data.totalSeconds) : "—"}
              </p>
            </div>
            {data?.jiraAuthorDisplayName ? (
              <p className="mt-2 text-sm text-text-secondary">
                Utilizador Jira: <span className="font-medium text-text-primary">{data.jiraAuthorDisplayName}</span>
              </p>
            ) : null}
            {data?.includesClockwork && (data.clockworkMergedCount ?? 0) > 0 ? (
              <p className="mt-2 text-sm text-text-secondary">
                Inclui{" "}
                <span className="font-medium text-text-primary">
                  {data.clockworkMergedCount} lançamento(s) Clockwork
                </span>{" "}
                não duplicados face ao Jira.
              </p>
            ) : null}
          </div>

          {!data?.entries.length ? (
            <EmptyState message="Não há lançamentos neste intervalo (Jira + Clockwork, se configurado)." />
          ) : (
            <div className="overflow-x-auto rounded-custom border border-border-default">
              <table className="w-full min-w-[42rem] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-border-default bg-neutral-grey-50 dark:bg-neutral-grey-900/40">
                    <th className="px-3 py-2 font-medium">Issue</th>
                    <th className="hidden px-3 py-2 font-medium sm:table-cell">Fonte</th>
                    <th className="px-3 py-2 font-medium">Resumo</th>
                    <th className="px-3 py-2 font-medium">Data</th>
                    <th className="px-3 py-2 font-medium">Tempo</th>
                    <th className="px-3 py-2 font-medium">Comentário</th>
                  </tr>
                </thead>
                <tbody>
                  {data.entries.map((row) => (
                    <tr
                      key={row.id}
                      className={cn(
                        "border-b border-border-default last:border-0",
                        row.isLongSession ? "bg-amber-500/10" : "hover:bg-neutral-grey-50/80 dark:hover:bg-neutral-grey-900/30",
                      )}
                    >
                      <td className="px-3 py-2 align-top font-mono text-xs sm:text-sm">
                        <div className="flex items-center gap-1.5">
                          {row.isLongSession ? (
                            <AlertTriangle
                              className="size-4 shrink-0 text-amber-600"
                              aria-label="Lançamento superior a 8 horas"
                            />
                          ) : null}
                          {jiraBase ? (
                            <a
                              href={`${jiraBase}/browse/${encodeURIComponent(row.issueKey)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-brand-primary underline-offset-2 hover:underline"
                            >
                              {row.issueKey}
                            </a>
                          ) : (
                            row.issueKey
                          )}
                        </div>
                      </td>
                      <td className="hidden whitespace-nowrap px-3 py-2 align-top text-xs text-text-secondary sm:table-cell">
                        {row.dataSource === "clockwork" ? (
                          <span className="rounded bg-violet-500/15 px-1.5 py-0.5 font-medium text-violet-800 dark:text-violet-200">
                            Clockwork
                          </span>
                        ) : (
                          <span className="text-text-secondary">Jira</span>
                        )}
                      </td>
                      <td className="max-w-[14rem] px-3 py-2 align-top text-text-primary">
                        {row.summary ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 align-top text-text-secondary">
                        {new Date(row.started).toLocaleString("pt-BR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 align-top tabular-nums font-medium">
                        {formatHoursShort(row.hours)}
                      </td>
                      <td className="max-w-[18rem] px-3 py-2 align-top text-text-secondary">
                        {row.comment ? (
                          <span className="line-clamp-3" title={row.comment}>
                            {row.comment}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
