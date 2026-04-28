"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { RefreshCw } from "lucide-react"
import { TableToolbar } from "@/components/qagrotis/TableToolbar"
import { TablePagination } from "@/components/qagrotis/TablePagination"

const ITEMS_PER_PAGE = 12

export interface TarefaRow {
  id: string
  key: string
  summary: string
  status: string
  assignee: string
  priority: string
  updatedAt: string
}

interface Props {
  rows: TarefaRow[]
  jiraBaseUrl: string
  error: string
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

export function TarefasClient({ rows, jiraBaseUrl, error }: Props) {
  const router = useRouter()
  const [isRefreshing, startRefreshTransition] = useTransition()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [assigneeFilter, setAssigneeFilter] = useState("")
  const [currentPage, setCurrentPage] = useState(1)

  const statusOptions = useMemo(
    () =>
      Array.from(new Set(rows.map((r) => r.status).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, "pt-BR"),
      ),
    [rows],
  )

  const assigneeOptions = useMemo(
    () =>
      Array.from(new Set(rows.map((r) => r.assignee).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, "pt-BR"),
      ),
    [rows],
  )

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase()

    return rows.filter((row) => {
      if (statusFilter && row.status !== statusFilter) return false
      if (assigneeFilter && row.assignee !== assigneeFilter) return false
      if (!term) return true

      const haystack = `${row.key} ${row.summary} ${row.status} ${row.assignee} ${row.priority}`.toLowerCase()
      return haystack.includes(term)
    })
  }, [rows, search, statusFilter, assigneeFilter])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / ITEMS_PER_PAGE))
  const safePage = Math.min(currentPage, totalPages)
  const pageRows = filteredRows.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE)
  const activeFilterCount = [statusFilter, assigneeFilter].filter(Boolean).length

  const toolbarExtra = (
    <div className="flex items-center gap-2">
      <select
        value={statusFilter}
        onChange={(e) => {
          setStatusFilter(e.target.value)
          setCurrentPage(1)
        }}
        className="h-9 w-32 rounded-custom border border-border-default bg-surface-input px-2 text-xs text-text-primary outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 lg:w-44 lg:text-sm"
      >
        <option value="">Status (todos)</option>
        {statusOptions.map((status) => (
          <option key={status} value={status}>
            {status}
          </option>
        ))}
      </select>

      <select
        value={assigneeFilter}
        onChange={(e) => {
          setAssigneeFilter(e.target.value)
          setCurrentPage(1)
        }}
        className="h-9 w-36 rounded-custom border border-border-default bg-surface-input px-2 text-xs text-text-primary outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 lg:w-52 lg:text-sm"
      >
        <option value="">Responsável (todos)</option>
        {assigneeOptions.map((assignee) => (
          <option key={assignee} value={assignee}>
            {assignee}
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
      <div className="rounded-xl bg-surface-card shadow-card overflow-hidden">
        <TableToolbar
          search={search}
          onSearchChange={(value) => {
            setSearch(value)
            setCurrentPage(1)
          }}
          searchPlaceholder="Buscar chave, resumo, status..."
          totalLabel="Total de tarefas UX"
          totalCount={filteredRows.length}
          baseCount={rows.length}
          activeFilterCount={activeFilterCount}
          extra={toolbarExtra}
        />

        {error ? (
          <div className="m-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : rows.length === 0 ? (
          <div className="m-4 rounded-lg border border-border-default bg-neutral-grey-50 px-6 py-10 text-center text-sm text-text-secondary">
            Nenhuma tarefa de UX encontrada no Jira.
          </div>
        ) : pageRows.length === 0 ? (
          <div className="m-4 rounded-lg border border-border-default bg-neutral-grey-50 px-6 py-10 text-center text-sm text-text-secondary">
            Nenhuma tarefa corresponde aos filtros atuais.
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
