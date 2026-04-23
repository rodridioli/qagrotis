"use client"

import * as React from "react"
import Image from "next/image"
import { ExternalLink, MoreVertical, Pencil, Trash2 } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import type { EquipeChapterListRow } from "@/lib/actions/equipe-chapters"

export interface EquipeChaptersTableProps {
  rows: EquipeChapterListRow[]
  isAdmin: boolean
  onEdit: (row: EquipeChapterListRow) => void
  onRequestDelete: (row: EquipeChapterListRow) => void
}

function isSafeExternalUrl(h: string | null | undefined): h is string {
  if (!h?.trim()) return false
  try {
    const u = new URL(h.trim())
    return u.protocol === "https:" || u.protocol === "http:"
  } catch {
    return false
  }
}

function formatDataPt(ymd: string): string {
  const [y, m, d] = ymd.split("-")
  if (!y || !m || !d) return ymd
  return `${d}/${m}/${y}`
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "?"
}

/**
 * Tabela de chapters (padrão visual alinhado a EquipeHorariosTable).
 */
export function EquipeChaptersTable({ rows, isAdmin, onEdit, onRequestDelete }: EquipeChaptersTableProps) {
  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-border-default bg-surface-card py-16 shadow-card">
        <p className="text-sm text-text-secondary">Nenhum chapter cadastrado.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border-default bg-surface-card shadow-card">
      <table className="w-full min-w-[320px] text-sm">
        <thead>
          <tr className="border-b border-border-default bg-neutral-grey-50 dark:bg-neutral-grey-900/40">
            <th className="px-3 py-3 text-left text-xs font-semibold text-text-secondary sm:px-4">Edição</th>
            <th className="px-3 py-3 text-left text-xs font-semibold text-text-secondary sm:px-4">Data</th>
            <th className="px-3 py-3 text-left text-xs font-semibold text-text-secondary sm:px-4">Tema</th>
            <th className="px-3 py-3 text-left text-xs font-semibold text-text-secondary sm:px-4">Autor(res)</th>
            <th className="w-12 px-2 py-3 text-center text-xs font-semibold text-text-secondary sm:px-3">Link</th>
            {isAdmin ? (
              <th className="w-12 px-2 py-3 text-center text-xs font-semibold text-text-secondary sm:px-3">
                <span className="sr-only">Ações</span>
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const canLink = isSafeExternalUrl(r.hyperlink)
            return (
              <tr
                key={r.id}
                className="border-b border-border-default last:border-b-0 transition-colors hover:bg-neutral-grey-50/80 dark:hover:bg-neutral-grey-900/25"
              >
                <td className="whitespace-nowrap px-3 py-3 tabular-nums text-text-primary sm:px-4">{r.edicao}</td>
                <td className="whitespace-nowrap px-3 py-3 tabular-nums text-text-primary sm:px-4">
                  {formatDataPt(r.dataYmd)}
                </td>
                <td className="max-w-[12rem] px-3 py-3 text-text-primary sm:max-w-md sm:px-4">
                  <span className="line-clamp-3 sm:line-clamp-2">{r.tema}</span>
                </td>
                <td className="min-w-0 max-w-[min(100%,20rem)] px-3 py-3 sm:max-w-none sm:px-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {(r.authors?.length ? r.authors : []).map((a) => (
                      <span
                        key={a.userId}
                        className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border-default bg-surface-input py-0.5 pl-0.5 pr-2 text-xs text-text-primary"
                        title={a.name}
                      >
                        {a.photoPath ? (
                          <Image
                            src={a.photoPath}
                            alt={a.name}
                            width={24}
                            height={24}
                            unoptimized
                            className="size-6 shrink-0 rounded-full object-cover"
                          />
                        ) : (
                          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-[10px] font-semibold text-brand-primary">
                            {getInitials(a.name)}
                          </span>
                        )}
                        <span className="min-w-0 max-w-[10rem] truncate font-medium sm:max-w-[12rem]">{a.name}</span>
                      </span>
                    ))}
                    {(!r.authors || r.authors.length === 0) && r.autoresLabel ? (
                      <span className="line-clamp-2 text-sm text-text-secondary">{r.autoresLabel}</span>
                    ) : null}
                  </div>
                </td>
                <td className="px-2 py-3 text-center sm:px-3">
                  {canLink ? (
                    <a
                      href={r.hyperlink!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex size-9 items-center justify-center rounded-md text-brand-primary transition-colors hover:bg-neutral-grey-100 hover:text-brand-primary"
                      aria-label="Abrir link em nova aba"
                    >
                      <ExternalLink className="size-4" />
                    </a>
                  ) : (
                    <span
                      className="inline-flex size-9 cursor-not-allowed items-center justify-center rounded-md text-text-secondary opacity-40"
                      aria-label="Sem link"
                      title="Sem link cadastrado"
                    >
                      <ExternalLink className="size-4" />
                    </span>
                  )}
                </td>
                {isAdmin ? (
                  <td className="px-2 py-3 text-center sm:px-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <button
                            type="button"
                            aria-label="Mais ações"
                            className="inline-flex size-9 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-neutral-grey-100 hover:text-text-primary"
                          />
                        }
                      >
                        <MoreVertical className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" side="bottom">
                        <DropdownMenuItem onClick={() => onEdit(r)}>
                          <Pencil className="size-4" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem variant="destructive" onClick={() => onRequestDelete(r)}>
                          <Trash2 className="size-4" />
                          Remover
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                ) : null}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
