"use client"

import * as React from "react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { EmptyState } from "@/components/shared/EmptyState"
import { SectionSpinner } from "@/components/shared/SectionSpinner"
import { TableToolbar } from "@/components/shared/TableToolbar"
import { Button } from "@/components/ui/button"
import { AusenciaTipoBadge } from "@/components/shared/StatusBadge"
import {
  listAllAusenciasAprovadas,
  type IndividualAusenciasRow,
} from "@/features/individual/actions/individual-ausencias"

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatIsoToBr(iso: string): string {
  const [y, m, d] = iso.split("-")
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

function formatCodigo(codigo: number): string {
  return `AUS-${String(codigo).padStart(3, "0")}`
}

function formatPeriodo(row: IndividualAusenciasRow): string {
  if (row.diaInteiro) return "Dia todo"
  if (row.horaInicio && row.horaFim) return `Das ${row.horaInicio} às ${row.horaFim}`
  return "Dia todo"
}

function truncate(str: string, max = 40): string {
  return str.length > max ? str.slice(0, max) + "…" : str
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? "")
    .join("")
}

// ── Component ─────────────────────────────────────────────────────────────────

export function EquipeAusenciasSection() {
  const [rows, setRows] = React.useState<IndividualAusenciasRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState("")

  const refetch = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setRows(await listAllAusenciasAprovadas())
    } catch (e) {
      setRows([])
      setError(e instanceof Error ? e.message : "Não foi possível carregar as ausências.")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => { void refetch() }, [refetch])

  const filtered = React.useMemo<IndividualAusenciasRow[]>(() => {
    if (!search.trim()) return rows
    const q = search.trim().toLowerCase()
    return rows.filter((r) =>
      formatCodigo(r.codigo).toLowerCase().includes(q) ||
      (r.evaluatedUser?.name ?? "").toLowerCase().includes(q),
    )
  }, [rows, search])

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="overflow-hidden rounded-xl border border-border-default bg-surface-card shadow-card">
        <TableToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Buscar por usuário…"
          totalLabel="Total de ausências"
          totalCount={rows.length}
          baseCount={rows.length}
        />

        {error ? (
          <div className="mx-4 my-3 flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <span className="flex-1">{error}</span>
            <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
              Tentar novamente
            </Button>
          </div>
        ) : null}

        {loading ? (
          <SectionSpinner />
        ) : filtered.length === 0 ? (
          <EmptyState message="Nenhuma ausência aprovada na equipe." />
        ) : (
          <div className="overflow-x-auto">
            <table className="qagrotis-table-row-hover-muted w-full min-w-[52rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border-default bg-neutral-grey-50">
                  <th className="px-3 py-3 text-left text-xs font-semibold text-text-secondary sm:px-4">Código</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-text-secondary sm:px-4">Usuário</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-text-secondary sm:px-4">Tipo</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-text-secondary sm:px-4">Data</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-text-secondary sm:px-4">Período</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-text-secondary sm:px-4">Justificativa</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const userName = row.evaluatedUser?.name ?? "Usuário"
                  const initials = getInitials(userName)
                  return (
                    <tr
                      key={row.id}
                      className="border-b border-border-default last:border-b-0 transition-colors"
                    >
                      {/* Código — sem hyperlink */}
                      <td className="whitespace-nowrap px-3 py-3 sm:px-4">
                        <span className="font-semibold tabular-nums text-text-primary">
                          {formatCodigo(row.codigo)}
                        </span>
                      </td>

                      {/* Usuário */}
                      <td className="whitespace-nowrap px-3 py-3 sm:px-4">
                        <div className="flex items-center gap-2.5">
                          <Avatar size="sm">
                            {row.evaluatedUser?.photoPath ? (
                              <AvatarImage src={row.evaluatedUser.photoPath} alt={userName} />
                            ) : null}
                            <AvatarFallback>{initials}</AvatarFallback>
                          </Avatar>
                          <span className="text-sm text-text-primary">{userName}</span>
                        </div>
                      </td>

                      {/* Tipo */}
                      <td className="whitespace-nowrap px-3 py-3 sm:px-4">
                        <AusenciaTipoBadge tipo={row.tipo} />
                      </td>

                      {/* Data */}
                      <td className="whitespace-nowrap px-3 py-3 text-sm text-text-primary tabular-nums sm:px-4">
                        {formatIsoToBr(row.dataIso)}
                      </td>

                      {/* Período */}
                      <td className="whitespace-nowrap px-3 py-3 text-sm text-text-primary sm:px-4">
                        {formatPeriodo(row)}
                      </td>

                      {/* Justificativa */}
                      <td className="px-3 py-3 text-sm text-text-secondary sm:px-4">
                        <span title={row.justificativa}>{truncate(row.justificativa)}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
