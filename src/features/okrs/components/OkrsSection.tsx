"use client"

import * as React from "react"
import { Plus, MoreVertical, Eye, CheckSquare, XSquare } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { EmptyState } from "@/components/shared/EmptyState"
import { SectionSpinner } from "@/components/shared/SectionSpinner"
import { TableToolbar } from "@/components/shared/TableToolbar"
import { OkrSituacaoBadge } from "@/features/okrs/components/OkrSituacaoBadge"
import { OkrProgressBar } from "@/features/okrs/components/OkrProgressBar"
import { OkrFormModal } from "@/features/okrs/components/OkrFormModal"
import { OkrDetailView } from "@/features/okrs/components/OkrDetailView"
import {
  PERIODO_LABELS,
  type OkrListRow,
  type OkrPeriodoDto,
} from "@/features/okrs/lib/okrs-schemas"
import {
  listOkrs,
  createOkr,
  updateOkrSituacao,
} from "@/features/okrs/actions/okrs"
import { buildRole, can } from "@/core/rbac/policy"

interface OkrsSectionProps {
  userType: string
  userAccessProfile: string
  currentUserId: string
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("pt-BR").format(new Date(iso))
  } catch {
    return iso
  }
}

export function OkrsSection({ userType, userAccessProfile, currentUserId }: OkrsSectionProps) {
  const role = buildRole(userType, userAccessProfile)
  const canCreate = can(role, "okr.create")
  const canEdit = can(role, "okr.edit")
  const canClose = can(role, "okr.close")
  const canCancel = can(role, "okr.cancel")

  const [okrs, setOkrs] = React.useState<OkrListRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [query, setQuery] = React.useState("")
  const [formOpen, setFormOpen] = React.useState(false)
  const [creating, setCreating] = React.useState(false)
  const [selectedOkrId, setSelectedOkrId] = React.useState<string | null>(null)
  const [actionSaving, setActionSaving] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    const res = await listOkrs()
    if ("error" in res) {
      toast.error(res.error)
    } else {
      setOkrs(res.data)
    }
    setLoading(false)
  }, [])

  React.useEffect(() => { load() }, [load])

  const filtered = okrs.filter((o) => {
    if (!query.trim()) return true
    const q = query.toLowerCase()
    return (
      o.codigo.toLowerCase().includes(q) ||
      PERIODO_LABELS[o.periodo].toLowerCase().includes(q) ||
      String(o.ano).includes(q)
    )
  })

  async function handleCreate(data: { ano: number; periodo: OkrPeriodoDto }) {
    setCreating(true)
    try {
      const res = await createOkr(data)
      if ("error" in res) { toast.error(res.error); return }
      toast.success(`OKR ${res.data.codigo} criado.`)
      setFormOpen(false)
      load()
    } finally {
      setCreating(false)
    }
  }

  async function handleSituacao(id: string, situacao: "ENCERRADO" | "CANCELADO") {
    setActionSaving(id)
    try {
      const res = await updateOkrSituacao(id, { situacao })
      if ("error" in res) { toast.error(res.error); return }
      toast.success(situacao === "ENCERRADO" ? "OKR encerrado." : "OKR cancelado.")
      load()
    } finally {
      setActionSaving(null)
    }
  }

  // Vista de detalhe
  if (selectedOkrId) {
    return (
      <OkrDetailView
        okrId={selectedOkrId}
        onBack={() => setSelectedOkrId(null)}
        userType={userType}
        userAccessProfile={userAccessProfile}
        currentUserId={currentUserId}
      />
    )
  }

  return (
    <div className="space-y-4">
      {loading ? (
        <SectionSpinner minHeight="min-h-[40vh]" />
      ) : (
        <div className="overflow-hidden rounded-xl bg-surface-card shadow-card">
          <TableToolbar
            search={query}
            onSearchChange={(v) => setQuery(v)}
            searchPlaceholder="Buscar OKR..."
            totalLabel="Total de OKRs"
            totalCount={filtered.length}
            baseCount={okrs.length}
            extra={
              canCreate ? (
                <Button onClick={() => setFormOpen(true)} className="shrink-0 gap-2">
                  <Plus className="size-4" />
                  Adicionar OKR
                </Button>
              ) : undefined
            }
          />
          {filtered.length === 0 ? (
            <EmptyState
              message={
                query.trim()
                  ? `Nenhum resultado para "${query}".`
                  : "Nenhum OKR cadastrado."
              }
            />
          ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border-default bg-muted/40">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Código</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Ano</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Período</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Objetivos</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Resultados-chave</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Situação</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Atualizado em</th>
                  <th className="w-12 px-3 py-3 text-center text-xs font-semibold text-text-secondary">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((okr) => (
                  <tr
                    key={okr.id}
                    className="border-b border-border-default last:border-b-0 transition-colors hover:bg-muted/20"
                  >
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setSelectedOkrId(okr.id)}
                        className="font-semibold text-primary hover:underline tabular-nums"
                      >
                        {okr.codigo}
                      </button>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-text-primary">{okr.ano}</td>
                    <td className="px-4 py-3 text-text-primary">{PERIODO_LABELS[okr.periodo]}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 min-w-[120px]">
                        <OkrProgressBar
                          value={okr.objetivosConcluidos}
                          max={okr.totalObjetivos || 1}
                          className="flex-1"
                        />
                        <span className="text-xs tabular-nums text-text-secondary whitespace-nowrap">
                          {okr.objetivosConcluidos}/{okr.totalObjetivos}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 min-w-[120px]">
                        <OkrProgressBar
                          value={okr.krsConcluidos}
                          max={okr.totalKrs || 1}
                          className="flex-1"
                        />
                        <span className="text-xs tabular-nums text-text-secondary whitespace-nowrap">
                          {okr.krsConcluidos}/{okr.totalKrs}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <OkrSituacaoBadge situacao={okr.situacao} />
                    </td>
                    <td className="px-4 py-3 tabular-nums text-text-secondary whitespace-nowrap">
                      {formatDate(okr.updatedAt)}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <button
                              type="button"
                              aria-label="Mais ações"
                              className="inline-flex size-9 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-muted hover:text-text-primary"
                            />
                          }
                        >
                          <MoreVertical className="size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" side="bottom">
                          <DropdownMenuItem onClick={() => setSelectedOkrId(okr.id)}>
                            <Eye className="size-4" />
                            Visualizar
                          </DropdownMenuItem>
                          {canClose && okr.situacao === "ATIVO" && (
                            <DropdownMenuItem
                              onClick={() => handleSituacao(okr.id, "ENCERRADO")}
                              disabled={actionSaving === okr.id}
                            >
                              <CheckSquare className="size-4" />
                              Encerrar
                            </DropdownMenuItem>
                          )}
                          {canCancel && okr.situacao !== "CANCELADO" && (
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => handleSituacao(okr.id, "CANCELADO")}
                              disabled={actionSaving === okr.id}
                            >
                              <XSquare className="size-4" />
                              Cancelar
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </div>
      )}

      <OkrFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleCreate}
        loading={creating}
      />
    </div>
  )
}
