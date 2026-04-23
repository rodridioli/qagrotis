"use client"

import * as React from "react"
import Image from "next/image"
import { Trophy } from "lucide-react"
import type { EquipeChapterRankingPage } from "@/lib/equipe-chapters-shared"
import { TablePagination } from "@/components/qagrotis/TablePagination"
import { cn } from "@/lib/utils"

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "?"
}

function posLabel(n: number): string {
  return `${n}°`
}

export interface EquipeChapterRankingProps {
  data: EquipeChapterRankingPage | null
  loading?: boolean
  onPageChange: (page: number) => void
  className?: string
}

/**
 * Ranking de autores por participação em chapters (paginado, 10 por página).
 */
export function EquipeChapterRanking({ data, loading, onPageChange, className }: EquipeChapterRankingProps) {
  return (
    <aside
      className={cn(
        "flex min-w-0 flex-col overflow-hidden rounded-xl border border-border-default bg-surface-card shadow-card",
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b border-border-default px-3 py-2.5 sm:px-4 sm:py-3">
        <Trophy className="size-4 shrink-0 text-brand-primary sm:size-5" aria-hidden />
        <h2 className="text-xs font-semibold text-text-primary sm:text-sm">Ranking</h2>
      </div>

      <div className={cn("relative min-w-0", loading && "pointer-events-none opacity-60")}>
        {!data || data.totalItems === 0 ? (
          <p className="px-3 py-6 text-center text-[11px] text-text-secondary sm:px-4 sm:text-xs">
            Nenhum ponto ainda.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[240px] table-fixed text-left">
                <thead>
                  <tr className="border-b border-border-default bg-neutral-grey-50 dark:bg-neutral-grey-900/40">
                    <th className="w-11 px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-text-secondary sm:w-12 sm:px-3 sm:py-2.5 sm:text-[11px]">
                      Pos
                    </th>
                    <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-text-secondary sm:px-3 sm:py-2.5 sm:text-[11px]">
                      Usuário
                    </th>
                    <th className="w-11 px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-text-secondary sm:w-14 sm:px-3 sm:py-2.5 sm:text-[11px]">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((e) => (
                    <tr
                      key={e.userId}
                      className="border-b border-border-default last:border-b-0 transition-colors hover:bg-neutral-grey-50/80 dark:hover:bg-neutral-grey-900/25"
                    >
                      <td className="px-2 py-1.5 align-middle sm:px-3 sm:py-2">
                        <span
                          className="inline-flex min-w-[1.75rem] items-center justify-center rounded-md bg-brand-primary px-1 py-0.5 text-[10px] font-bold tabular-nums text-primary-foreground sm:text-[11px]"
                          aria-hidden
                        >
                          {posLabel(e.position)}
                        </span>
                      </td>
                      <td className="min-w-0 px-2 py-1.5 align-middle sm:px-3 sm:py-2">
                        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
                          {e.photoPath ? (
                            <Image
                              src={e.photoPath}
                              alt={e.name}
                              width={28}
                              height={28}
                              unoptimized
                              className="size-6 shrink-0 rounded-full object-cover sm:size-7"
                            />
                          ) : (
                            <div
                              className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-[9px] font-semibold text-brand-primary sm:size-7 sm:text-[10px]"
                              aria-hidden
                            >
                              {getInitials(e.name)}
                            </div>
                          )}
                          <span
                            className="min-w-0 truncate text-[11px] font-medium text-brand-primary sm:text-xs"
                            title={e.name}
                          >
                            {e.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-2 py-1.5 text-right align-middle sm:px-3 sm:py-2">
                        <span className="text-[11px] font-semibold tabular-nums text-text-primary sm:text-xs">
                          {e.points}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.totalPages > 1 ? (
              <TablePagination
                currentPage={data.page}
                totalPages={data.totalPages}
                totalItems={data.totalItems}
                itemsPerPage={data.pageSize}
                onPageChange={onPageChange}
              />
            ) : null}
          </>
        )}
      </div>
    </aside>
  )
}
