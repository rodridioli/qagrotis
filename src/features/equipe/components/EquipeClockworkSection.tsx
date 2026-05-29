"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { ChevronDown, ChevronUp, Loader2, MoreVertical, Trash2 } from "lucide-react"
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { EmptyState } from "@/components/shared/EmptyState"
import { SectionSpinner } from "@/components/shared/SectionSpinner"
import { UserAvatar } from "@/features/equipe/components/EquipePerformanceCard"
import { cn } from "@/core/utils"
import {
  getEquipeMembrosParaLancamentos,
  type EquipeMembroLancamentos,
} from "@/features/equipe/actions/equipe"

// ── Types ─────────────────────────────────────────────────────────────────────

type AccessProfileId = "QA" | "UX" | "TW" | "MGR"
type PeriodId = "current" | "previous"

interface Props {
  userAccessProfile: AccessProfileId
  canFilterByProfile: boolean
  /** true apenas para Administrador:MGR — pode ver worklogs de qualquer membro. */
  canViewOthersClockwork: boolean
  /** ID do utilizador autenticado — usado como único membro quando canViewOthersClockwork=false. */
  currentUserId: string
}

interface CwWorklog {
  id: string
  issueKey: string
  summary: string
  started: string // ISO datetime UTC
  timeSpentSeconds: number
  comment: string
}

interface ApiResponse {
  worklogs: CwWorklog[]
  month: string
  fromIso: string
  toIso: string
}

interface EditState {
  startHHmm: string
  endHHmm: string
  comment: string
  saving: boolean
  saveError: string | null
}

interface GroupedDay {
  dateKey: string   // "YYYY-MM-DD" in SP timezone
  label: string     // e.g. "Quinta-feira, 28 de maio de 2026"
  worklogs: CwWorklog[]
  totalSeconds: number
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SP_OFFSET_MS = -3 * 60 * 60 * 1000 // UTC-3 (Brazil abolished DST 2019)
const VALID_PROFILES = new Set<string>(["QA", "UX", "TW"])
const VALID_PERIODS = new Set<string>(["current", "previous"])
const AVATAR_SIZE = 38

const ALL_PROFILE_OPTIONS: { value: Exclude<AccessProfileId, "MGR">; label: string }[] = [
  { value: "QA", label: "QA" },
  { value: "UX", label: "UX" },
  { value: "TW", label: "TW" },
]

const PERIOD_OPTIONS: { value: PeriodId; label: string }[] = [
  { value: "current",  label: "Mês atual" },
  { value: "previous", label: "Mês anterior" },
]

// ── Time helpers ──────────────────────────────────────────────────────────────

function toSPDate(iso: string): Date {
  return new Date(new Date(iso).getTime() + SP_OFFSET_MS)
}

function isoToHHmm(iso: string): string {
  const sp = toSPDate(iso)
  return `${String(sp.getUTCHours()).padStart(2, "0")}:${String(sp.getUTCMinutes()).padStart(2, "0")}`
}

function endTimeHHmm(iso: string, timeSpentSeconds: number): string {
  return isoToHHmm(new Date(new Date(iso).getTime() + timeSpentSeconds * 1000).toISOString())
}

function spDateKey(iso: string): string {
  const sp = toSPDate(iso)
  return `${sp.getUTCFullYear()}-${String(sp.getUTCMonth() + 1).padStart(2, "0")}-${String(sp.getUTCDate()).padStart(2, "0")}`
}

function spDateLabel(dateKey: string): string {
  const [y, mo, d] = dateKey.split("-").map(Number)
  const label = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y!, mo! - 1, d!)))
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function spToUtcIso(dateKey: string, hhmm: string): string {
  const [y, mo, d] = dateKey.split("-").map(Number)
  const [hStr, mStr] = hhmm.split(":")
  const h = parseInt(hStr ?? "0", 10)
  const m = parseInt(mStr ?? "0", 10)
  return new Date(Date.UTC(y!, mo! - 1, d!, h + 3, m, 0, 0)).toISOString()
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return "—"
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

function parseHHmm(hhmm: string): number {
  const [hStr, mStr] = hhmm.split(":")
  const h = parseInt(hStr ?? "", 10)
  const m = parseInt(mStr ?? "", 10)
  if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || h > 23 || m < 0 || m > 59) return -1
  return h * 60 + m
}

function deriveSeconds(startHHmm: string, endHHmm: string): number | null {
  const startMin = parseHHmm(startHHmm)
  const endMin   = parseHHmm(endHHmm)
  if (startMin < 0 || endMin < 0) return null
  const diff = (endMin - startMin) * 60
  return diff > 0 ? diff : null
}

// ── Group by date ─────────────────────────────────────────────────────────────

function groupByDate(worklogs: CwWorklog[]): GroupedDay[] {
  const map = new Map<string, CwWorklog[]>()
  for (const w of worklogs) {
    const key = spDateKey(w.started)
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(w)
  }
  return [...map.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([dateKey, wls]) => ({
      dateKey,
      label: spDateLabel(dateKey),
      worklogs: [...wls].sort((a, b) => a.started.localeCompare(b.started)),
      totalSeconds: wls.reduce((s, w) => s + w.timeSpentSeconds, 0),
    }))
}

function buildInitialEditState(worklogs: CwWorklog[]): Map<string, EditState> {
  const m = new Map<string, EditState>()
  for (const w of worklogs) {
    m.set(w.id, {
      startHHmm: isoToHHmm(w.started),
      endHHmm:   endTimeHHmm(w.started, w.timeSpentSeconds),
      comment:   w.comment,
      saving:    false,
      saveError: null,
    })
  }
  return m
}

// ── Main component ────────────────────────────────────────────────────────────

export function EquipeClockworkSection({ userAccessProfile, canFilterByProfile, canViewOthersClockwork, currentUserId }: Props) {
  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()

  const defaultProfile: Exclude<AccessProfileId, "MGR"> =
    userAccessProfile === "MGR" ? "QA" : (userAccessProfile as Exclude<AccessProfileId, "MGR">)

  const [profileFilter, setProfileFilter] = React.useState<Exclude<AccessProfileId, "MGR">>(() => {
    const v = searchParams.get("cwp")
    return v && VALID_PROFILES.has(v) ? (v as Exclude<AccessProfileId, "MGR">) : defaultProfile
  })

  const [period, setPeriod] = React.useState<PeriodId>(() => {
    const v = searchParams.get("cwper")
    return v && VALID_PERIODS.has(v) ? (v as PeriodId) : "current"
  })

  const [membros, setMembros]               = React.useState<EquipeMembroLancamentos[]>([])
  const [membrosLoading, setMembrosLoading] = React.useState(true)
  const [selectedUserId, setSelectedUserId] = React.useState<string | null>(null)
  const initialMembroRef = React.useRef(searchParams.get("cwm"))

  const [worklogs, setWorklogs]                 = React.useState<CwWorklog[]>([])
  const [monthLabel, setMonthLabel]             = React.useState<string>("")
  const [worklogsLoading, setWorklogsLoading]   = React.useState(false)
  const [worklogsError, setWorklogsError]       = React.useState<string | null>(null)
  const [editMap, setEditMap]                   = React.useState<Map<string, EditState>>(new Map())
  const [collapsed, setCollapsed]               = React.useState<Set<string>>(new Set())

  // Delete state
  const [deleteTarget, setDeleteTarget] = React.useState<CwWorklog | null>(null)
  const [deleting, setDeleting]         = React.useState(false)
  const deletingRef                     = React.useRef(false) // guards against concurrent clicks

  // Derived
  const selectedMembro = React.useMemo(
    () => membros.find((m) => m.userId === selectedUserId) ?? null,
    [membros, selectedUserId],
  )
  const totalSecondsMonth = React.useMemo(
    () => worklogs.reduce((s, w) => s + w.timeSpentSeconds, 0),
    [worklogs],
  )

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set(key, value)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  function handleProfileChange(v: Exclude<AccessProfileId, "MGR">) {
    setProfileFilter(v)
    setParam("cwp", v)
  }

  function handlePeriodChange(v: PeriodId) {
    setPeriod(v)
    setParam("cwper", v)
  }

  function handleMemberSelect(userId: string) {
    setSelectedUserId(userId)
    setParam("cwm", userId)
  }

  function toggleDay(dateKey: string) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(dateKey)) next.delete(dateKey)
      else next.add(dateKey)
      return next
    })
  }

  // Load team members — only MGR can view others; everyone else sees only their own data
  React.useEffect(() => {
    if (!canViewOthersClockwork) {
      setMembrosLoading(false)
      setSelectedUserId(currentUserId)
      return
    }
    let cancelled = false
    setMembrosLoading(true)
    setSelectedUserId(null)
    const profile = canFilterByProfile ? profileFilter : userAccessProfile
    getEquipeMembrosParaLancamentos(profile).then((data) => {
      if (!cancelled) {
        const visible = data.filter((m) => m.accessProfile !== "MGR")
        setMembros(visible)
        const urlMembro = initialMembroRef.current
        const match = urlMembro ? visible.find((m) => m.userId === urlMembro) : null
        setSelectedUserId(match ? match.userId : (visible[0]?.userId ?? null))
        initialMembroRef.current = null
        setMembrosLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [profileFilter, canFilterByProfile, userAccessProfile, canViewOthersClockwork, currentUserId])

  // Load worklogs when user or period changes
  React.useEffect(() => {
    if (!selectedUserId) {
      setWorklogs([])
      setEditMap(new Map())
      setMonthLabel("")
      return
    }

    let cancelled = false
    setWorklogsLoading(true)
    setWorklogsError(null)

    fetch(
      `/api/clockwork/worklogs?userId=${encodeURIComponent(selectedUserId)}&period=${period}`,
      { method: "GET", credentials: "same-origin" },
    )
      .then(async (res) => {
        const json = (await res.json()) as ApiResponse & { error?: string }
        if (!res.ok) throw new Error(json.error ?? "Erro ao buscar worklogs.")
        return json
      })
      .then((data) => {
        if (!cancelled) {
          setWorklogs(data.worklogs ?? [])
          setMonthLabel(data.month ?? "")
          setEditMap(buildInitialEditState(data.worklogs ?? []))
          setCollapsed(new Set())
          setWorklogsLoading(false)
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : "Erro ao buscar worklogs."
          setWorklogsError(
            msg === "CLOCKWORK_NOT_CONFIGURED"
              ? "Clockwork não configurado. Adicione o token em Configurações → Clockwork."
              : msg,
          )
          setWorklogs([])
          setEditMap(new Map())
          setWorklogsLoading(false)
        }
      })

    return () => { cancelled = true }
  }, [selectedUserId, period])

  // ── Edit handlers ─────────────────────────────────────────────────────────────

  function updateEdit(id: string, patch: Partial<EditState>) {
    setEditMap((prev) => {
      const next = new Map(prev)
      const cur  = next.get(id)
      if (!cur) return prev
      next.set(id, { ...cur, ...patch })
      return next
    })
  }

  async function saveWorklog(worklog: CwWorklog, state: EditState) {
    const dateKey = spDateKey(worklog.started)
    const seconds = deriveSeconds(state.startHHmm, state.endHHmm)
    if (seconds === null) {
      updateEdit(worklog.id, { saveError: "Horário inválido: fim deve ser após o início.", saving: false })
      return
    }
    const newStarted = spToUtcIso(dateKey, state.startHHmm)
    updateEdit(worklog.id, { saving: true, saveError: null })
    try {
      const res = await fetch("/api/clockwork/worklogs", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ worklogId: worklog.id, started: newStarted, timeSpentSeconds: seconds, comment: state.comment }),
      })
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(json.error ?? `Erro ${res.status}`)
      }
      setWorklogs((prev) =>
        prev.map((w) => w.id === worklog.id ? { ...w, started: newStarted, timeSpentSeconds: seconds, comment: state.comment } : w),
      )
      updateEdit(worklog.id, { saving: false, saveError: null })
    } catch (e) {
      updateEdit(worklog.id, { saving: false, saveError: e instanceof Error ? e.message : "Erro ao salvar." })
    }
  }

  // ── Delete handlers ────────────────────────────────────────────────────────────

  async function confirmDelete() {
    if (!deleteTarget || deletingRef.current) return
    deletingRef.current = true
    setDeleting(true)
    const targetId = deleteTarget.id
    try {
      const res = await fetch("/api/clockwork/worklogs", {
        method: "DELETE",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ worklogId: targetId, issueKey: deleteTarget.issueKey }),
      })
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        throw new Error(json.error ?? `Erro HTTP ${res.status} ao remover worklog ${targetId}`)
      }
      setWorklogs((prev) => prev.filter((w) => w.id !== targetId))
      setEditMap((prev) => { const next = new Map(prev); next.delete(targetId); return next })
      setDeleteTarget(null)
      toast.success("Registro removido com sucesso.")
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao remover."
      console.error("[EquipeClockworkSection] confirmDelete error:", msg)
      toast.error(msg, { duration: 8000 })
      setDeleteTarget(null) // fecha o modal para que o usuário veja o toast
    } finally {
      deletingRef.current = false
      setDeleting(false)
    }
  }

  const grouped = React.useMemo(() => groupByDate(worklogs), [worklogs])

  // ── Render ────────────────────────────────────────────────────────────────────

  if (membrosLoading) return <SectionSpinner minHeight="min-h-[24rem]" />

  const showSummary = !worklogsLoading && !worklogsError && worklogs.length > 0 && selectedMembro

  return (
    <>
      {/* Delete confirmation — reuses the shared ConfirmDialog */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open && !deletingRef.current) setDeleteTarget(null) }}
        title="Excluir registro?"
        description="Esta ação não pode ser desfeita."
        confirmLabel={deleting ? "Excluindo…" : "Excluir"}
        confirmIcon={deleting
          ? <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
          : <Trash2 className="size-4 shrink-0" aria-hidden />
        }
        disabled={deleting}
        onConfirm={() => void confirmDelete()}
      />

      <div className="flex flex-col gap-4">
        {/* Controls bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Avatar strip (MGR) / Totalizador compacto (não-MGR) */}
          <div className="min-w-0 flex-1">
            {!canViewOthersClockwork && !worklogsLoading && !worklogsError && worklogs.length > 0 && (
              <p className="pl-1 text-sm text-text-secondary" aria-live="polite">
                Total em {monthLabel}
                <span className="mx-1.5" aria-hidden>·</span>
                <span className="font-semibold tabular-nums text-text-primary">
                  {formatDuration(totalSecondsMonth)}
                </span>
              </p>
            )}
            {canViewOthersClockwork && !membrosLoading && membros.length > 0 && (
              <TooltipProvider delay={0} closeDelay={0}>
                <div
                  className="flex w-full flex-wrap items-center justify-start gap-y-2 pl-2"
                  role="toolbar"
                  aria-label="Selecionar membro para visualizar worklogs"
                >
                  {membros.map((m, idx) => {
                    const selected = m.userId === selectedUserId
                    return (
                      <Tooltip key={m.userId}>
                        <TooltipTrigger
                          render={
                            <button
                              type="button"
                              aria-current={selected ? "true" : undefined}
                              aria-label={`${m.name}${selected ? " (selecionado)" : ""}`}
                              onClick={() => handleMemberSelect(m.userId)}
                              className={cn(
                                "relative rounded-full border-[3px] border-surface-card bg-surface-card shadow-sm duration-100 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 motion-reduce:transition-none",
                                selected
                                  ? "z-20 border-brand-primary ring-2 ring-brand-primary/35"
                                  : "z-10 hover:z-30 hover:ring-1 hover:ring-brand-primary/25",
                              )}
                              style={{ marginLeft: idx === 0 ? 0 : -12 }}
                            />
                          }
                        >
                          <UserAvatar name={m.name} photoPath={m.photoPath ?? null} size={AVATAR_SIZE} />
                        </TooltipTrigger>
                        <TooltipContent>{m.name}</TooltipContent>
                      </Tooltip>
                    )
                  })}
                </div>
              </TooltipProvider>
            )}
          </div>

          {/* Selects */}
          <div className="flex shrink-0 items-center gap-2">
            {canFilterByProfile && (
              <Select
                value={profileFilter}
                onValueChange={(v) => v && handleProfileChange(v as Exclude<AccessProfileId, "MGR">)}
              >
                <SelectTrigger className="w-28" aria-label="Filtrar por perfil">
                  <SelectValue />
                </SelectTrigger>
                <SelectPopup>
                  {ALL_PROFILE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectPopup>
              </Select>
            )}

            <Select
              value={period}
              onValueChange={(v) => v && handlePeriodChange(v as PeriodId)}
            >
              <SelectTrigger className="w-40" aria-label="Período">
                <SelectValue>
                  {(v: string | null) => PERIOD_OPTIONS.find((o) => o.value === v)?.label ?? v ?? ""}
                </SelectValue>
              </SelectTrigger>
              <SelectPopup>
                {PERIOD_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectPopup>
            </Select>
          </div>
        </div>

        {/* Summary card — member + total hours */}
        {showSummary && (
          <div className="flex items-center justify-between rounded-xl bg-surface-card px-4 py-3 shadow-card">
            <div className="flex items-center gap-3">
              <UserAvatar
                name={selectedMembro.name}
                photoPath={selectedMembro.photoPath ?? null}
                size={32}
              />
              <div>
                <p className="text-sm font-semibold text-text-primary">{selectedMembro.name}</p>
                <p className="text-xs text-text-secondary">{monthLabel}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-text-secondary">Total no mês</p>
              <p className="text-sm font-semibold tabular-nums text-text-primary">
                {formatDuration(totalSecondsMonth)}
              </p>
            </div>
          </div>
        )}

        {/* Content */}
        {canViewOthersClockwork && membros.length === 0 ? (
          <EmptyState message="Nenhum membro encontrado neste perfil." />
        ) : worklogsLoading ? (
          <SectionSpinner minHeight="min-h-[20rem]" />
        ) : worklogsError ? (
          <div className="flex items-center justify-center rounded-xl border border-border-default bg-surface-card py-16 shadow-card px-4">
            <p className="text-center text-sm text-destructive">{worklogsError}</p>
          </div>
        ) : worklogs.length === 0 ? (
          <EmptyState message="Nenhum registro encontrado." />
        ) : (
          <div className="flex flex-col gap-4">
            {grouped.map((day) => (
              <DayGroup
                key={day.dateKey}
                day={day}
                editMap={editMap}
                collapsed={collapsed.has(day.dateKey)}
                onToggle={() => toggleDay(day.dateKey)}
                onFieldChange={(id, field, value) => updateEdit(id, { [field]: value, saveError: null })}
                onBlurSave={(worklog, state) => saveWorklog(worklog, state)}
                onDeleteClick={(worklog) => setDeleteTarget(worklog)}
              />
            ))}
          </div>
        )}
      </div>
    </>
  )
}

// ── DayGroup ─────────────────────────────────────────────────────────────────

export interface DayGroupProps {
  day: GroupedDay
  editMap: Map<string, EditState>
  collapsed: boolean
  onToggle: () => void
  onFieldChange: (id: string, field: keyof Pick<EditState, "startHHmm" | "endHHmm" | "comment">, value: string) => void
  onBlurSave: (worklog: CwWorklog, state: EditState) => void
  onDeleteClick: (worklog: CwWorklog) => void
}

export function DayGroup({ day, editMap, collapsed, onToggle, onFieldChange, onBlurSave, onDeleteClick }: DayGroupProps) {
  return (
    <div className="overflow-hidden rounded-xl bg-surface-card shadow-card">
      {/* Collapsible header */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        className="flex w-full items-center justify-between border-b border-border-default bg-neutral-grey-50 px-4 py-3 text-left transition-colors hover:bg-neutral-grey-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-primary"
      >
        <div className="flex items-center gap-3">
          {collapsed
            ? <ChevronDown className="size-4 shrink-0 text-text-secondary" aria-hidden />
            : <ChevronUp   className="size-4 shrink-0 text-text-secondary" aria-hidden />
          }
          <span className="text-sm font-semibold text-text-primary">{day.label}</span>
        </div>
        <span className="ml-4 shrink-0 text-xs font-medium tabular-nums text-text-secondary">
          {formatDuration(day.totalSeconds)} total
        </span>
      </button>

      {/* Table — hidden when collapsed */}
      {!collapsed && (
        <div className="overflow-x-auto">
          <table className="qagrotis-table-row-hover w-full min-w-[780px] table-fixed text-sm">
            <colgroup>
              <col style={{ width: "9rem"   }} />
              <col />
              <col style={{ width: "8.5rem" }} />
              <col style={{ width: "8.5rem" }} />
              <col style={{ width: "6rem"   }} />
              <col style={{ width: "3rem"   }} />
            </colgroup>
            <thead>
              <tr className="border-b border-border-default bg-neutral-grey-50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Jira</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Descrição</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Início</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Fim</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Total</th>
                <th className="py-3 pr-3" />
              </tr>
            </thead>
            <tbody>
              {day.worklogs.map((w) => {
                const state = editMap.get(w.id)
                if (!state) return null
                const seconds = deriveSeconds(state.startHHmm, state.endHHmm)
                return (
                  <WorklogRow
                    key={w.id}
                    worklog={w}
                    state={state}
                    totalSeconds={seconds}
                    onFieldChange={onFieldChange}
                    onBlurSave={onBlurSave}
                    onDeleteClick={onDeleteClick}
                  />
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── WorklogRow ────────────────────────────────────────────────────────────────

interface WorklogRowProps {
  worklog: CwWorklog
  state: EditState
  totalSeconds: number | null
  onFieldChange: (id: string, field: keyof Pick<EditState, "startHHmm" | "endHHmm" | "comment">, value: string) => void
  onBlurSave: (worklog: CwWorklog, state: EditState) => void
  onDeleteClick: (worklog: CwWorklog) => void
}

function WorklogRow({ worklog, state, totalSeconds, onFieldChange, onBlurSave, onDeleteClick }: WorklogRowProps) {
  // DOM refs — always reflect the live input value regardless of React's render cycle.
  // This avoids a stale-closure bug where onBlur fires before the onChange state update
  // has been committed, causing handleBlur to see the old props and skip the save.
  const startInputRef   = React.useRef<HTMLInputElement>(null)
  const endInputRef     = React.useRef<HTMLInputElement>(null)
  const commentInputRef = React.useRef<HTMLInputElement>(null)

  const lastSavedRef = React.useRef({
    startHHmm: state.startHHmm,
    endHHmm:   state.endHHmm,
    comment:   state.comment,
  })

  function handleBlur() {
    if (state.saving) return
    // Read live DOM values — not the (potentially stale) React state
    const startHHmm = startInputRef.current?.value   ?? state.startHHmm
    const endHHmm   = endInputRef.current?.value     ?? state.endHHmm
    const comment   = commentInputRef.current?.value ?? state.comment
    const last = lastSavedRef.current
    const changed = startHHmm !== last.startHHmm || endHHmm !== last.endHHmm || comment !== last.comment
    if (!changed) return
    lastSavedRef.current = { startHHmm, endHHmm, comment }
    onBlurSave(worklog, { ...state, startHHmm, endHHmm, comment })
  }

  const editInputClass = cn(
    "w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-sm text-text-primary",
    "hover:border-border-default focus:border-brand-primary focus:bg-surface-card focus:outline-none focus:ring-1 focus:ring-brand-primary/30",
    "transition-colors placeholder:text-text-tertiary disabled:cursor-not-allowed disabled:opacity-50",
    state.saving && "pointer-events-none opacity-50",
  )

  return (
    <>
      <tr className="border-b border-border-default last:border-0 transition-colors">
        {/* Jira key — link opens in a new tab */}
        <td className="px-4 py-3">
          <a
            href={`https://agrotis.atlassian.net/browse/${worklog.issueKey}`}
            target="_blank"
            rel="noreferrer"
            className="whitespace-nowrap text-sm font-medium text-brand-primary hover:underline"
          >
            {worklog.issueKey}
          </a>
        </td>

        {/* Description (editable) */}
        <td className="min-w-0 px-4 py-3">
          <input
            ref={commentInputRef}
            type="text"
            value={state.comment}
            disabled={state.saving}
            aria-label={`Descrição do lançamento ${worklog.issueKey}`}
            onChange={(e) => onFieldChange(worklog.id, "comment", e.target.value)}
            onBlur={handleBlur}
            className={editInputClass}
            placeholder="Sem descrição"
          />
        </td>

        {/* Start time (editable) */}
        <td className="px-4 py-3">
          <input
            ref={startInputRef}
            type="time"
            value={state.startHHmm}
            disabled={state.saving}
            aria-label={`Início — ${worklog.issueKey}`}
            onChange={(e) => onFieldChange(worklog.id, "startHHmm", e.target.value)}
            onBlur={handleBlur}
            className={cn(editInputClass, "tabular-nums")}
          />
        </td>

        {/* End time (editable) */}
        <td className="px-4 py-3">
          <input
            ref={endInputRef}
            type="time"
            value={state.endHHmm}
            disabled={state.saving}
            aria-label={`Fim — ${worklog.issueKey}`}
            onChange={(e) => onFieldChange(worklog.id, "endHHmm", e.target.value)}
            onBlur={handleBlur}
            className={cn(editInputClass, "tabular-nums")}
          />
        </td>

        {/* Duration */}
        <td className="px-4 py-3">
          {state.saving ? (
            <span className="flex items-center gap-1.5 text-xs text-text-secondary">
              <Loader2 className="size-3 animate-spin" />
              Salvando…
            </span>
          ) : (
            <span className={cn(
              "text-sm font-medium tabular-nums",
              totalSeconds == null ? "text-destructive" : "text-text-primary",
            )}>
              {totalSeconds != null ? formatDuration(totalSeconds) : "—"}
            </span>
          )}
        </td>

        {/* Row actions — MoreVertical dropdown */}
        <td className="py-3 pr-3 text-right">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  aria-label="Mais ações"
                  className="flex size-8 cursor-pointer items-center justify-center rounded-md text-text-secondary hover:bg-neutral-grey-100 disabled:pointer-events-none disabled:opacity-30"
                  disabled={state.saving}
                />
              }
            >
              <MoreVertical className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="bottom">
              <DropdownMenuItem variant="destructive" onClick={() => onDeleteClick(worklog)}>
                <Trash2 className="size-4" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </td>
      </tr>

      {state.saveError && (
        <tr>
          <td colSpan={6} className="px-4 pb-2.5 pt-0">
            <p className="text-xs text-destructive">{state.saveError}</p>
          </td>
        </tr>
      )}
    </>
  )
}
