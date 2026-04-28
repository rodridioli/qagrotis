"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { RefreshCw } from "lucide-react"
import { TableToolbar } from "@/components/qagrotis/TableToolbar"
import { TablePagination } from "@/components/qagrotis/TablePagination"
import { TAREFAS_ASSIGNEE_EMPTY } from "./jira-tarefas-constants"

const ITEMS_PER_PAGE = 12

export interface TarefaRow {
  id: string
  key: string
  summary: string
  status: string
  assignee: string
  /** Para filtro na URL / JQL; `null` = sem assignee no Jira. */
  assigneeAccountId: string | null
  priority: string
  updatedAt: string
}

interface Props {
  rows: TarefaRow[]
  jiraBaseUrl: string
  error: string
  /** True quando o Jira ainda tinha mais páginas mas paramos no limite configurado no servidor. */
  truncated?: boolean
  truncatedMaxIssues?: number
  /** Filtros aplicados no servidor (query string). */
  urlStatus: string
  urlAssignee: string
  /** Status possíveis do projeto UX (API do Jira); fallback para valores vindos nas linhas. */
  statusOptionsFromProject: string[]
}

function formatDate(value: string): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date)
}

function buildTarefasPath(next: { status?: string; assignee?: string }): string {
  const p = new URLSearchParams()
  if (next.status?.trim()) p.set("status", next.status.trim())
  if (next.assignee?.trim()) p.set("assignee", next.assignee.trim())
  const q = p.toString()
  return q ? `/tarefas?${q}` : "/tarefas"
}

export function TarefasClient({
  rows,
  jiraBaseUrl,
  error,
  truncated,
  truncatedMaxIssues,
  urlStatus,
  urlAssignee,
  statusOptionsFromProject,
}: Props) {
  const router = useRouter()
  const [isRefreshing, startRefreshTransition] = useTransition()
  const [search, setSearch] = useState("")
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    setCurrentPage(1)
  }, [urlStatus, urlAssignee])

  const statusSelectOptions = useMemo(() => {
    if (statusOptionsFromProject.length > 0) return statusOptionsFromProject
    return Array.from(new Set(rows.map((r) => r.status).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, "pt-BR"),
    )
  }, [statusOptionsFromProject, rows])

  /** Só assignees com accountId; “Não atribuído” é opção fixa no `<select>`. */
  const assigneeSelectOptions = useMemo(() => {
    const m = new Map<string, string>()
    for (const r of rows) {
      const acc = r.assigneeAccountId?.trim()
      if (!acc) continue
      if (!m.has(acc)) m.set(acc, r.assignee)
    }
    return [...m.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"))
  }, [rows])

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return rows
    return rows.filter((row) => {
      const haystack = `${row.key} ${row.summary} ${row.status} ${row.assignee} ${row.priority}`.toLowerCase()
      return haystack.includes(term)
    })
  }, [rows, search])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / ITEMS_PER_PAGE))
  const safePage = Math.min(currentPage, totalPages)
  const pageRows = filteredRows.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE)
  const activeFilterCount = [urlStatus, urlAssignee].filter(Boolean).length

  function navigateTo(next: { status?: string; assignee?: string }) {
    /** Não usar `startTransition` aqui: em App Router pode atrasar/cancelar soft navigation e os filtros “não mudam”. */
    void router.push(buildTarefasPath(next))
  }

  const toolbarExtra = (
    <div className="flex items-center gap-2">
      <select
        value={urlStatus}
        onChange={(e) => {
          const v = e.target.value
          setCurrentPage(1)
          // Ao mudar status, limpa assignee (evita combinação inválida e simplifica a URL).
          navigateTo({ status: v || undefined, assignee: undefined })
        }}
        className="h-9 w-32 rounded-custom border border-border-default bg-surface-input px-2 text-xs text-text-primary outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 lg:w-44 lg:text-sm"
      >
        <option value="">Status (todos)</option>
        {statusSelectOptions.map((status) => (
          <option key={status} value={status}>
            {status}
          </option>
        ))}
      </select>

      <select
        value={urlAssignee}
        onChange={(e) => {
          const v = e.target.value
          setCurrentPage(1)
          navigateTo({
            status: urlStatus || undefined,
            assignee: v || undefined,
          })
        }}
        className="h-9 w-36 rounded-custom border border-border-default bg-surface-input px-2 text-xs text-text-primary outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 lg:w-52 lg:text-sm"
      >
        <option value="">Responsável (todos)</option>
        <option value={TAREFAS_ASSIGNEE_EMPTY}>Não atribuído</option>
        {assigneeSelectOptions.map(({ value, label }) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={() =>
          startRefreshTransition(() => {
            router.refresh()
          })
        }
        className="inline-flex h-9 items-center gap-1 rounded-custom border border-border-default bg-surface-input px-3 text-xs font-medium text-text-primary transition-colors hover:bg-neutral-grey-100 lg:text-sm"
      >
        <RefreshCw className={`size-4 ${isRefreshing ? "animate-spin" : ""}`} />
        Recarregar
      </button>
    </div>
  )

  return (
    <div className="space-y-4">
      {truncated && truncatedMaxIssues != null && truncatedMaxIssues > 0 && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-text-primary">
          A listagem foi limitada a <span className="font-semibold">{truncatedMaxIssues.toLocaleString("pt-BR")}</span>{" "}
          issues por desempenho. O Jira pode ter mais registros para este JQL; os totais aqui refletem só o que foi carregado.
        </div>
      )}
      <div className="rounded-xl bg-surface-card shadow-card overflow-hidden">
        <TableToolbar
          search={search}
          onSearchChange={(value) => {
            setSearch(value)
            setCurrentPage(1)
          }}
          searchPlaceholder="Buscar chave, resumo, status..."
          totalLabel="Total de tarefas (Jira)"
          totalCount={filteredRows.length}
          /**
           * `TableToolbar` esconde busca e `extra` quando `baseCount === 0`.
           * Com filtro Jira que retorna 0 linhas, `rows.length` zera e sumiam os selects — impossível limpar o filtro.
           */
          baseCount={Math.max(rows.length, 1)}
          activeFilterCount={activeFilterCount}
          extra={toolbarExtra}
        />

        {error ? (
          <div className="m-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : rows.length === 0 ? (
          <div className="m-4 rounded-lg border border-border-default bg-neutral-grey-50 px-6 py-10 text-center text-sm text-text-secondary">
            Nenhuma tarefa encontrada no Jira para os filtros atuais.
          </div>
        ) : pageRows.length === 0 ? (
          <div className="m-4 rounded-lg border border-border-default bg-neutral-grey-50 px-6 py-10 text-center text-sm text-text-secondary">
            Nenhuma tarefa corresponde à busca digitada.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="qagrotis-table-row-hover w-full min-w-180 table-fixed text-sm">
                <colgroup>
                  <col className="w-28" />
                  <col />
                  <col className="w-36" />
                  <col className="w-40" />
                  <col className="w-32" />
                  <col className="w-36" />
                </colgroup>
                <thead>
                  <tr className="border-b border-border-default bg-neutral-grey-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Chave</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Resumo</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Responsável</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Prioridade</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Atualizado em</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((row) => (
                    <tr key={row.id} className="border-b border-border-default last:border-0">
                      <td className="bg-surface-card px-4 py-3 font-medium text-brand-primary">
                        <a
                          href={`${jiraBaseUrl}/browse/${row.key}`}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:underline"
                        >
                          {row.key}
                        </a>
                      </td>
                      <td className="bg-surface-card px-4 py-3 text-text-primary">{row.summary}</td>
                      <td className="bg-surface-card px-4 py-3 text-text-secondary">{row.status}</td>
                      <td className="bg-surface-card px-4 py-3 text-text-secondary">{row.assignee}</td>
                      <td className="bg-surface-card px-4 py-3 text-text-secondary">{row.priority}</td>
                      <td className="bg-surface-card px-4 py-3 text-text-secondary">{formatDate(row.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <TablePagination
              currentPage={safePage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              totalItems={filteredRows.length}
              itemsPerPage={ITEMS_PER_PAGE}
            />
          </>
        )}
      </div>
    </div>
  )
}
