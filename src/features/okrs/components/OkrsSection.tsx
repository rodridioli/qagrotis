"use client"

import * as React from "react"
import { Plus, MoreVertical, Eye, CheckSquare, RotateCcw, Trash2 } from "lucide-react"
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
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
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
  deleteOkr,
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
  const canClose = can(role, "okr.close")
  const canDelete = can(role, "okr.delete")

  const [okrs, setOkrs] = React.useState<OkrListRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [query, setQuery] = React.useState("")
  const [formOpen, setFormOpen] = React.useState(false)
  const [creating, setCreating] = React.useState(false)
  const [selectedOkrId, setSelectedOkrId] = React.useState<string | null>(null)
  const [actionSaving, setActionSaving] = React.useState<string | null>(null)
  const [deleteTargetId, setDeleteTargetId] = React.useState<string | null>(null)
  const [closeTargetId, setCloseTargetId] = React.useState<string | null>(null)

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

  async function handleEncerrar() {
    if (!closeTargetId) return
    const id = closeTargetId
    setCloseTargetId(null)
    setActionSaving(id)
    try {
      const res = await updateOkrSituacao(id, { situacao: "ENCERRADO" })
      if ("error" in res) { toast.error(res.error); return }
      toast.success("OKR encerrado.")
      load()
    } finally {
      setActionSaving(null)
    }
  }

  async function handleReabrir(id: string) {
    setActionSaving(id)
    try {
      const res = await updateOkrSituacao(id, { situacao: "ATIVO" })
      if ("error" in res) { toast.error(res.error); return }
      toast.success("OKR reaberto.")
      load()
    } finally {
      setActionSaving(null)
    }
  }

  async function handleDelete() {
    if (!deleteTargetId) return
    const id = deleteTargetId
    setDeleteTargetId(null)
    setActionSaving(id)
    try {
      const res = await deleteOkr(id)
      if ("error" in res) { toast.error(res.error); return }
      toast.success("OKR excluído.")
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
      {/* Header externo ao card — padrão da plataforma */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-lg font-semibold text-text-primary">OKRs</p>
        {canCreate && (
          <Button onClick={() => setFormOpen(true)} className="gap-2">
            <Plus className="size-4" />
            Adicionar OKR
          </Button>
        )}
      </div>

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
          />
          {filtered.length === 0 ? (
            <EmptyState message="Nenhum registro encontrado." />
          ) : (
          <div className="overflow-x-auto">
            <table className="qagrotis-table-row-hover w-full min-w-[640px] table-fixed text-sm">
              <colgroup>
                <col />
                <col />
                <col />
                <col />
                <col />
                <col />
                <col />
                <col className="w-12" />
              </colgroup>
              <thead>
                <tr className="border-b border-border-default bg-neutral-grey-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Código</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Ano</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Período</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Objetivos</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Resultados-chave</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Situação</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Atualizado em</th>
                  <th className="w-12 py-3 pr-4 text-right text-xs font-semibold text-text-secondary">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((okr) => (
                  <tr
                    key={okr.id}
                    className="border-b border-border-default last:border-b-0 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setSelectedOkrId(okr.id)}
                        className="font-semibold text-brand-primary hover:underline tabular-nums"
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
                    <td className="w-12 py-3 pr-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <button
                              type="button"
                              aria-label="Mais ações"
                              className="ml-auto flex size-8 cursor-pointer items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-neutral-grey-100 hover:text-text-primary"
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
                              onClick={() => setCloseTargetId(okr.id)}
                              disabled={actionSaving === okr.id}
                            >
                              <CheckSquare className="size-4" />
                              Encerrar
                            </DropdownMenuItem>
                          )}
                          {canClose && okr.situacao === "ENCERRADO" && (
                            <DropdownMenuItem
                              onClick={() => handleReabrir(okr.id)}
                              disabled={actionSaving === okr.id}
                            >
                              <RotateCcw className="size-4" />
                              Reabrir
                            </DropdownMenuItem>
                          )}
                          {canDelete && (
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => setDeleteTargetId(okr.id)}
                              disabled={actionSaving === okr.id}
                            >
                              <Trash2 className="size-4" />
                              Excluir
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

      {/* Modal de confirmação — Encerrar */}
      <ConfirmDialog
        open={closeTargetId !== null}
        onOpenChange={(open) => { if (!open) setCloseTargetId(null) }}
        title="Encerrar OKR"
        description="Ao encerrar este OKR, todas as opções de edição serão desativadas. Você poderá reabri-lo posteriormente se necessário. Deseja continuar?"
        confirmLabel="Encerrar"
        confirmIcon={<CheckSquare className="size-4" />}
        buttonVariant="default"
        disabled={actionSaving !== null}
        onConfirm={handleEncerrar}
      />

      {/* Modal de confirmação — Excluir */}
      <ConfirmDialog
        open={deleteTargetId !== null}
        onOpenChange={(open) => { if (!open) setDeleteTargetId(null) }}
        title="Excluir OKR"
        description="Esta ação é permanente e removerá todos os Objetivos e Resultados-chave vinculados. Deseja continuar?"
        confirmLabel="Excluir"
        confirmIcon={<Trash2 className="size-4" />}
        disabled={actionSaving !== null}
        onConfirm={handleDelete}
      />
    </div>
  )
}
