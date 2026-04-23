"use client"

import { useState, useMemo } from "react"
import { ChevronDown, ChevronUp, Filter, X } from "lucide-react"
import { TableToolbar } from "@/components/qagrotis/TableToolbar"
import { TablePagination } from "@/components/qagrotis/TablePagination"
import { ChangelogTagBadge } from "@/components/qagrotis/StatusBadge"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import type { ChangelogEntry } from "@/lib/actions/changelog"

const ITEMS_PER_PAGE = 10

const ALL_TAGS = ["Novidade", "Melhoria"]

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-")
  return `${d}/${m}/${y}`
}

interface Props {
  entries: ChangelogEntry[]
}

export function AtualizacoesClient({ entries }: Props) {
  const [search, setSearch] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [filterOpen, setFilterOpen] = useState(false)

  const [filterTag, setFilterTag] = useState("")
  const [filterDateFrom, setFilterDateFrom] = useState("")
  const [filterDateTo, setFilterDateTo] = useState("")

  const [pendingTag, setPendingTag] = useState("")
  const [pendingDateFrom, setPendingDateFrom] = useState("")
  const [pendingDateTo, setPendingDateTo] = useState("")

  const activeFilterCount = [filterTag, filterDateFrom, filterDateTo].filter(Boolean).length

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      // Force hide anything that is not officially Novelty or Improvement
      if (e.tag !== "Novidade" && e.tag !== "Melhoria") return false
      
      if (search) {
        const q = search.toLowerCase()
        if (!e.version.toLowerCase().includes(q) && !e.changes.some((c) => c.toLowerCase().includes(q))) return false
      }
      if (filterTag && e.tag !== filterTag) return false
      if (filterDateFrom && e.date < filterDateFrom) return false
      if (filterDateTo && e.date > filterDateTo) return false
      return true
    })
  }, [search, filterTag, filterDateFrom, filterDateTo, entries])

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE)
  const pageItems = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

  function openFilter() {
    setPendingTag(filterTag)
    setPendingDateFrom(filterDateFrom)
    setPendingDateTo(filterDateTo)
    setFilterOpen(true)
  }

  function applyFilters() {
    setFilterTag(pendingTag)
    setFilterDateFrom(pendingDateFrom)
    setFilterDateTo(pendingDateTo)
    setFilterOpen(false)
    setCurrentPage(1)
  }

  function clearFilters() {
    setPendingTag("")
    setPendingDateFrom("")
    setPendingDateTo("")
    setFilterTag("")
    setFilterDateFrom("")
    setFilterDateTo("")
    setFilterOpen(false)
    setCurrentPage(1)
  }

  function toggleExpand(version: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(version)) next.delete(version)
      else next.add(version)
      return next
    })
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-surface-card shadow-card overflow-hidden">
        <TableToolbar
          search={search}
          onSearchChange={(v) => { setSearch(v); setCurrentPage(1) }}
          searchPlaceholder="Buscar versão ou descrição..."
          totalLabel="Total de versões"
          totalCount={filtered.length}
          baseCount={entries.length}
          activeFilterCount={activeFilterCount}
          onFilterOpen={openFilter}
        />

        {pageItems.length === 0 ? (
          <div className="mx-4 my-6 rounded-lg border border-border-default bg-neutral-grey-50 px-6 py-10 text-center text-sm text-text-secondary">
            Nenhuma versão encontrada.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="qagrotis-table-row-hover w-full min-w-120 table-fixed text-sm">
                <colgroup>
                  <col className="w-24" />
                  <col className="w-28" />
                  <col className="w-28" />
                  <col />
                  <col className="w-16" />
                </colgroup>
                <thead>
                  <tr className="border-b border-border-default bg-neutral-grey-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Versão</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Data</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Categoria</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Alterações</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((entry) => {
                    const isExpanded = expanded.has(entry.version)
                    const preview = entry.changes[0]
                    const hasMore = entry.changes.length > 1

                    return (
                      <tr
                        key={entry.version}
                        className="group border-b border-border-default last:border-0"
                      >
                        <td className="px-4 py-3 whitespace-nowrap transition-colors group-hover:bg-neutral-grey-50">
                          <span className="font-mono text-sm font-semibold text-text-primary">
                            v{entry.version}
                          </span>
                          {entry.commit !== "pendente" && (
                            <p className="font-mono text-xs text-text-secondary/70 mt-0.5 truncate">
                              {entry.commit}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-text-secondary transition-colors group-hover:bg-neutral-grey-50">{formatDate(entry.date)}</td>
                        <td className="px-4 py-3 transition-colors group-hover:bg-neutral-grey-50">
                          <ChangelogTagBadge tag={entry.tag} />
                        </td>
                        <td className="px-4 py-3 transition-colors group-hover:bg-neutral-grey-50">
                          {isExpanded ? (
                            <ul className="space-y-1.5">
                              {entry.changes.map((c, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-primary" />
                                  {c}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-sm text-text-secondary">
                              <span className="line-clamp-2">{preview}</span>
                              {hasMore && (
                                <span className="mt-0.5 block text-xs text-text-secondary/60">
                                  +{entry.changes.length - 1} alteração{entry.changes.length - 1 !== 1 ? "ões" : ""} adicionais
                                </span>
                              )}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 transition-colors group-hover:bg-neutral-grey-50">
                          {hasMore && (
                            <button
                              type="button"
                              onClick={() => toggleExpand(entry.version)}
                              className="flex size-8 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-neutral-grey-100 hover:text-text-primary"
                              title={isExpanded ? "Recolher" : "Expandir"}
                            >
                              {isExpanded
                                ? <ChevronUp className="size-4" />
                                : <ChevronDown className="size-4" />
                              }
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <TablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              totalItems={filtered.length}
              itemsPerPage={ITEMS_PER_PAGE}
            />
          </>
        )}
      </div>

      {/* Filter Modal */}
      <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
        <DialogContent className="w-full max-w-sm">
          <DialogHeader>
            <DialogTitle>Filtrar versões</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">Categoria</label>
              <select
                value={pendingTag}
                onChange={(e) => setPendingTag(e.target.value)}
                className="h-9 w-full rounded-custom border border-border-default bg-surface-input px-3 text-sm text-text-primary outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
              >
                <option value="">Todas as categorias</option>
                {ALL_TAGS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">Data de</label>
              <input
                type="date"
                value={pendingDateFrom}
                onChange={(e) => {
                  const val = e.target.value
                  setPendingDateFrom(val)
                  if (pendingDateTo && val > pendingDateTo) setPendingDateTo("")
                }}
                className="h-9 w-full rounded-custom border border-border-default bg-surface-input px-3 text-sm text-text-primary outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">Data até</label>
              <input
                type="date"
                value={pendingDateTo}
                min={pendingDateFrom || undefined}
                onChange={(e) => setPendingDateTo(e.target.value)}
                className="h-9 w-full rounded-custom border border-border-default bg-surface-input px-3 text-sm text-text-primary outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
              />
            </div>
          </div>

          <DialogFooter showCloseButton={false}>
            <DialogClose render={<Button variant="ghost" onClick={clearFilters} />}>Limpar filtros</DialogClose>
            <div className="flex gap-2">
              <DialogClose render={<Button variant="outline" />}><X className="size-4" />Cancelar</DialogClose>
              <Button onClick={applyFilters}><Filter className="size-4" />Filtrar</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
