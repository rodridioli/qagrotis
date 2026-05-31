"use client"

import * as React from "react"
import { Check, Loader2, Plus, X } from "lucide-react"
import { toast } from "sonner"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { EmptyState } from "@/components/shared/EmptyState"
import { SectionSpinner } from "@/components/shared/SectionSpinner"
import { TableToolbar } from "@/components/shared/TableToolbar"
import { AusenciaTipoBadge } from "@/components/shared/StatusBadge"
import {
  listAllAusenciasAprovadas,
  createIndividualAusencias,
  type IndividualAusenciasRow,
  type AusenciaTipo,
} from "@/features/individual/actions/individual-ausencias"
import { getActiveQaUsers, type QaUserRecord } from "@/features/usuarios/actions/usuarios"
import {
  createAusenciaSchema,
} from "@/features/individual/lib/individual-ausencias-schemas"

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatIsoToBr(iso: string): string {
  const [y, m, d] = iso.split("-")
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

function formatPeriodo(dataInicioIso: string, dataFimIso: string): string {
  if (dataInicioIso === dataFimIso) return formatIsoToBr(dataInicioIso)
  return `${formatIsoToBr(dataInicioIso)} – ${formatIsoToBr(dataFimIso)}`
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

// ── Constants ─────────────────────────────────────────────────────────────────

const TIPO_OPTIONS: { value: AusenciaTipo; label: string }[] = [
  { value: "FALTA",       label: "Falta" },
  { value: "BANCO_HORAS", label: "Banco de horas" },
  { value: "ATESTADO",    label: "Atestado" },
  { value: "ATRASO",      label: "Atraso" },
  { value: "OUTRO",       label: "Outro" },
]

// ── Form state ────────────────────────────────────────────────────────────────

interface FormState {
  evaluatedUserId: string
  tipo: AusenciaTipo | ""
  dataInicioIso: string
  dataFimIso: string
  justificativa: string
}

const EMPTY_FORM: FormState = {
  evaluatedUserId: "",
  tipo: "",
  dataInicioIso: "",
  dataFimIso: "",
  justificativa: "",
}

interface FieldErrors {
  evaluatedUserId?: boolean
  tipo?: boolean
  dataInicioIso?: boolean
  dataFimIso?: boolean
  dataFimAntes?: boolean
  justificativa?: boolean
}

// ── Component ─────────────────────────────────────────────────────────────────

interface EquipeAusenciasSectionProps {
  isMgr: boolean
  currentUserId: string
}

export function EquipeAusenciasSection({ isMgr, currentUserId }: EquipeAusenciasSectionProps) {
  const [rows, setRows] = React.useState<IndividualAusenciasRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState("")

  // Modal state
  const [modalOpen, setModalOpen] = React.useState(false)
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM)
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({})
  const [saving, setSaving] = React.useState(false)
  const [users, setUsers] = React.useState<QaUserRecord[]>([])
  const [loadingUsers, setLoadingUsers] = React.useState(false)

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

  async function openModal() {
    setForm({ ...EMPTY_FORM, evaluatedUserId: isMgr ? "" : currentUserId })
    setFieldErrors({})
    setModalOpen(true)
    if (isMgr && users.length === 0) {
      setLoadingUsers(true)
      try {
        setUsers(await getActiveQaUsers())
      } finally {
        setLoadingUsers(false)
      }
    }
  }

  async function handleSave() {
    const errs: FieldErrors = {}
    if (isMgr && !form.evaluatedUserId) errs.evaluatedUserId = true
    if (!form.tipo) errs.tipo = true
    if (!form.dataInicioIso) errs.dataInicioIso = true
    if (!form.dataFimIso) errs.dataFimIso = true
    if (form.dataInicioIso && form.dataFimIso && form.dataFimIso < form.dataInicioIso) {
      errs.dataFimAntes = true
    }
    if (!form.justificativa.trim()) errs.justificativa = true
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs)
      toast.error("Preencha todos os campos obrigatórios.")
      return
    }

    const payload = {
      evaluatedUserId: form.evaluatedUserId,
      tipo: form.tipo as AusenciaTipo,
      dataInicioIso: form.dataInicioIso,
      dataFimIso: form.dataFimIso,
      justificativa: form.justificativa.trim(),
    }

    const parsed = createAusenciaSchema.safeParse(payload)
    if (!parsed.success) {
      toast.error("Dados inválidos. Verifique os campos.")
      return
    }

    setFieldErrors({})
    setSaving(true)
    try {
      const res = await createIndividualAusencias(payload)
      if ("error" in res) { toast.error(res.error); return }
      toast.success("Solicitação enviada para aprovação.")
      setModalOpen(false)
    } finally {
      setSaving(false)
    }
  }

  const todayIso = React.useMemo(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
  }, [])

  const currentRows = React.useMemo<IndividualAusenciasRow[]>(
    () => rows.filter((r) => r.dataFimIso >= todayIso),
    [rows, todayIso],
  )

  const filtered = React.useMemo<IndividualAusenciasRow[]>(() => {
    const q = search.trim().toLowerCase()
    const searched = q
      ? currentRows.filter((r) => (r.evaluatedUser?.name ?? "").toLowerCase().includes(q))
      : currentRows
    return [...searched].sort((a, b) => a.dataInicioIso.localeCompare(b.dataInicioIso))
  }, [currentRows, search])

  if (loading) return <SectionSpinner minHeight="min-h-[60vh]" />

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex justify-end">
        <Button type="button" className="gap-2" onClick={() => void openModal()}>
          <Plus className="size-4" aria-hidden />
          Adicionar Ausência
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border-default bg-surface-card shadow-card">
        <TableToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Buscar por usuário…"
          totalLabel="Total de ausências"
          totalCount={currentRows.length}
          baseCount={currentRows.length}
        />

        {error ? (
          <div className="mx-4 my-3 flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <span className="flex-1">{error}</span>
            <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
              Tentar novamente
            </Button>
          </div>
        ) : null}

        {filtered.length === 0 ? (
          <EmptyState message="Nenhum registro encontrado." />
        ) : (
          <div className="overflow-x-auto">
            <table className="qagrotis-table-row-hover-muted w-full min-w-[48rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border-default bg-neutral-grey-50">
                  <th className="px-3 py-3 text-left text-xs font-semibold text-text-secondary sm:px-4">Período</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-text-secondary sm:px-4">Usuário</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-text-secondary sm:px-4">Tipo</th>
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
                      <td className="whitespace-nowrap px-3 py-3 text-sm text-text-primary tabular-nums sm:px-4">
                        {formatPeriodo(row.dataInicioIso, row.dataFimIso)}
                      </td>

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

                      <td className="whitespace-nowrap px-3 py-3 sm:px-4">
                        <AusenciaTipoBadge tipo={row.tipo} />
                      </td>

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

      {/* ── Create modal ─────────────────────────────────────────────────────── */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent showCloseButton className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar ausência</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            {/* Usuário — apenas Administrador:MGR pode selecionar outro membro */}
            {isMgr && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-text-primary" htmlFor="eq-aus-user">
                  Membro da equipe <span className="text-destructive" aria-hidden>*</span>
                </label>
                {loadingUsers ? (
                  <div className="flex h-9 items-center gap-2 text-sm text-text-secondary">
                    <Loader2 className="size-4 animate-spin" />
                    Carregando usuários…
                  </div>
                ) : (
                  <Select
                    value={form.evaluatedUserId}
                    onValueChange={(v) => {
                      setForm((f) => ({ ...f, evaluatedUserId: v ?? "" }))
                      setFieldErrors((p) => ({ ...p, evaluatedUserId: false }))
                    }}
                    aria-label="Membro da equipe"
                  >
                    <SelectTrigger
                      id="eq-aus-user"
                      className={fieldErrors.evaluatedUserId ? "border-destructive" : ""}
                    >
                      <SelectValue>
                        {users.find((u) => u.id === form.evaluatedUserId)?.name ?? "Selecione o membro"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectPopup>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name}
                        </SelectItem>
                      ))}
                    </SelectPopup>
                  </Select>
                )}
              </div>
            )}

            {/* Tipo */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary" htmlFor="eq-aus-tipo">
                Tipo de ausência <span className="text-destructive" aria-hidden>*</span>
              </label>
              <Select
                value={form.tipo}
                onValueChange={(v) => {
                  setForm((f) => ({ ...f, tipo: v as AusenciaTipo }))
                  setFieldErrors((p) => ({ ...p, tipo: false }))
                }}
                aria-label="Tipo de ausência"
              >
                <SelectTrigger
                  id="eq-aus-tipo"
                  className={fieldErrors.tipo ? "border-destructive" : ""}
                >
                  <SelectValue>
                    {TIPO_OPTIONS.find((o) => o.value === form.tipo)?.label ?? "Selecione o tipo"}
                  </SelectValue>
                </SelectTrigger>
                <SelectPopup>
                  {TIPO_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectPopup>
              </Select>
            </div>

            {/* Data de Início e Data de Término */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-text-primary" htmlFor="eq-aus-data-inicio">
                  Data de Início <span className="text-destructive" aria-hidden>*</span>
                </label>
                <input
                  id="eq-aus-data-inicio"
                  type="date"
                  value={form.dataInicioIso}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, dataInicioIso: e.target.value }))
                    setFieldErrors((p) => ({ ...p, dataInicioIso: false, dataFimAntes: false }))
                  }}
                  className={`h-9 w-full rounded-lg border bg-surface-input px-3 py-1 text-sm text-text-primary shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-primary ${fieldErrors.dataInicioIso ? "border-destructive" : "border-border-default"}`}
                  style={{ colorScheme: "light" }}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-text-primary" htmlFor="eq-aus-data-fim">
                  Data de Término <span className="text-destructive" aria-hidden>*</span>
                </label>
                <input
                  id="eq-aus-data-fim"
                  type="date"
                  value={form.dataFimIso}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, dataFimIso: e.target.value }))
                    setFieldErrors((p) => ({ ...p, dataFimIso: false, dataFimAntes: false }))
                  }}
                  className={`h-9 w-full rounded-lg border bg-surface-input px-3 py-1 text-sm text-text-primary shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-primary ${fieldErrors.dataFimIso || fieldErrors.dataFimAntes ? "border-destructive" : "border-border-default"}`}
                  style={{ colorScheme: "light" }}
                />
                {fieldErrors.dataFimAntes && (
                  <p className="text-xs text-destructive">
                    A data de término deve ser igual ou posterior à data de início.
                  </p>
                )}
              </div>
            </div>

            {/* Justificativa */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary" htmlFor="eq-aus-justificativa">
                Justificativa <span className="text-destructive" aria-hidden>*</span>
              </label>
              <textarea
                id="eq-aus-justificativa"
                rows={3}
                value={form.justificativa}
                placeholder="Descreva o motivo da ausência…"
                onChange={(e) => {
                  setForm((f) => ({ ...f, justificativa: e.target.value }))
                  setFieldErrors((p) => ({ ...p, justificativa: false }))
                }}
                className={`w-full rounded-lg border bg-surface-input px-3 py-2 text-sm text-text-primary shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-primary resize-none ${fieldErrors.justificativa ? "border-destructive" : "border-border-default"}`}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="gap-1.5"
              onClick={() => setModalOpen(false)}
              disabled={saving}
            >
              <X className="size-4 shrink-0" aria-hidden />
              Cancelar
            </Button>
            <Button
              type="button"
              className="gap-1.5"
              onClick={() => void handleSave()}
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                  Enviando…
                </>
              ) : (
                <>
                  <Check className="size-4 shrink-0" aria-hidden />
                  Enviar solicitação
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
