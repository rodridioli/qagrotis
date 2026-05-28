"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
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

interface Props {
  userAccessProfile: AccessProfileId
  canFilterByProfile: boolean
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
  label: string     // e.g. "quinta-feira, 28 de maio de 2026"
  worklogs: CwWorklog[]
  totalSeconds: number
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SP_OFFSET_MS = -3 * 60 * 60 * 1000 // UTC-3 (Brazil abolished DST 2019)
const VALID_PROFILES = new Set<string>(["QA", "UX", "TW"])
const AVATAR_SIZE = 38

const ALL_PROFILE_OPTIONS: { value: Exclude<AccessProfileId, "MGR">; label: string }[] = [
  { value: "QA", label: "QA" },
  { value: "UX", label: "UX" },
  { value: "TW", label: "TW" },
]

// ── Time helpers ──────────────────────────────────────────────────────────────

/** Converts an ISO datetime string to a Date in São Paulo local time offset. */
function toSPDate(iso: string): Date {
  return new Date(new Date(iso).getTime() + SP_OFFSET_MS)
}

/** Extracts HH:mm from an ISO datetime string (São Paulo time). */
function isoToHHmm(iso: string): string {
  const sp = toSPDate(iso)
  const h = String(sp.getUTCHours()).padStart(2, "0")
  const m = String(sp.getUTCMinutes()).padStart(2, "0")
  return `${h}:${m}`
}

/** Gets the end time from started + timeSpentSeconds. */
function endTimeHHmm(iso: string, timeSpentSeconds: number): string {
  const endIso = new Date(new Date(iso).getTime() + timeSpentSeconds * 1000).toISOString()
  return isoToHHmm(endIso)
}

/** Date key "YYYY-MM-DD" in São Paulo timezone. */
function spDateKey(iso: string): string {
  const sp = toSPDate(iso)
  const y = sp.getUTCFullYear()
  const mo = String(sp.getUTCMonth() + 1).padStart(2, "0")
  const d = String(sp.getUTCDate()).padStart(2, "0")
  return `${y}-${mo}-${d}`
}

/** Human-readable date label in Portuguese (weekday, day month year). */
function spDateLabel(dateKey: string): string {
  const [y, mo, d] = dateKey.split("-").map(Number)
  const date = new Date(Date.UTC(y!, mo! - 1, d!))
  const label = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date)
  return label.charAt(0).toUpperCase() + label.slice(1)
}

/** Builds a UTC ISO datetime from a date key (SP) + HH:mm (SP local time). */
function spToUtcIso(dateKey: string, hhmm: string): string {
  const [y, mo, d] = dateKey.split("-").map(Number)
  const [hStr, mStr] = hhmm.split(":")
  const h = parseInt(hStr ?? "0", 10)
  const m = parseInt(mStr ?? "0", 10)
  // SP = UTC-3, so UTC = SP + 3h
  const utcMs = Date.UTC(y!, mo! - 1, d!, h + 3, m, 0, 0)
  return new Date(utcMs).toISOString()
}

/** Formats total seconds as "Xh Ym" or "Ym". */
function formatDuration(seconds: number): string {
  if (seconds <= 0) return "—"
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

/** Parses HH:mm into total minutes. Returns -1 if invalid. */
function parseHHmm(hhmm: string): number {
  const [hStr, mStr] = hhmm.split(":")
  const h = parseInt(hStr ?? "", 10)
  const m = parseInt(mStr ?? "", 10)
  if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || h > 23 || m < 0 || m > 59) return -1
  return h * 60 + m
}

/** Derives timeSpentSeconds from start and end HH:mm. Returns null if invalid. */
function deriveSeconds(startHHmm: string, endHHmm: string): number | null {
  const startMin = parseHHmm(startHHmm)
  const endMin = parseHHmm(endHHmm)
  if (startMin < 0 || endMin < 0) return null
  const diff = (endMin - startMin) * 60
  if (diff <= 0) return null
  return diff
}

// ── Group worklogs by SP date ─────────────────────────────────────────────────

function groupByDate(worklogs: CwWorklog[]): GroupedDay[] {
  const map = new Map<string, CwWorklog[]>()
  for (const w of worklogs) {
    const key = spDateKey(w.started)
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(w)
  }
  return [...map.entries()]
    .sort(([a], [b]) => b.localeCompare(a)) // descending (newest first)
    .map(([dateKey, wls]) => ({
      dateKey,
      label: spDateLabel(dateKey),
      worklogs: [...wls].sort((a, b) => a.started.localeCompare(b.started)),
      totalSeconds: wls.reduce((s, w) => s + w.timeSpentSeconds, 0),
    }))
}

// ── Edit state helpers ────────────────────────────────────────────────────────

function buildInitialEditState(worklogs: CwWorklog[]): Map<string, EditState> {
  const m = new Map<string, EditState>()
  for (const w of worklogs) {
    m.set(w.id, {
      startHHmm: isoToHHmm(w.started),
      endHHmm: endTimeHHmm(w.started, w.timeSpentSeconds),
      comment: w.comment,
      saving: false,
      saveError: null,
    })
  }
  return m
}

// ── Main component ────────────────────────────────────────────────────────────

export function EquipeClockworkSection({ userAccessProfile, canFilterByProfile }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const defaultProfile: Exclude<AccessProfileId, "MGR"> =
    userAccessProfile === "MGR" ? "QA" : (userAccessProfile as Exclude<AccessProfileId, "MGR">)

  const [profileFilter, setProfileFilter] = React.useState<Exclude<AccessProfileId, "MGR">>(() => {
    const v = searchParams.get("cwp")
    return v && VALID_PROFILES.has(v) ? (v as Exclude<AccessProfileId, "MGR">) : defaultProfile
  })
  const [membros, setMembros] = React.useState<EquipeMembroLancamentos[]>([])
  const [membrosLoading, setMembrosLoading] = React.useState(true)
  const [selectedUserId, setSelectedUserId] = React.useState<string | null>(null)

  const initialMembroRef = React.useRef(searchParams.get("cwm"))

  // Worklog state
  const [worklogs, setWorklogs] = React.useState<CwWorklog[]>([])
  const [monthLabel, setMonthLabel] = React.useState<string>("")
  const [worklogsLoading, setWorklogsLoading] = React.useState(false)
  const [worklogsError, setWorklogsError] = React.useState<string | null>(null)

  // Edit state: keyed by worklog id
  const [editMap, setEditMap] = React.useState<Map<string, EditState>>(new Map())

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set(key, value)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  function handleProfileChange(v: Exclude<AccessProfileId, "MGR">) {
    setProfileFilter(v)
    setParam("cwp", v)
  }

  function handleMemberSelect(userId: string) {
    setSelectedUserId(userId)
    setParam("cwm", userId)
  }

  // Load team members
  React.useEffect(() => {
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
  }, [profileFilter, canFilterByProfile, userAccessProfile])

  // Load worklogs whenever selectedUserId changes
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

    fetch(`/api/clockwork/worklogs?userId=${encodeURIComponent(selectedUserId)}`, {
      method: "GET",
      credentials: "same-origin",
    })
      .then(async (res) => {
        const json = await res.json() as ApiResponse & { error?: string }
        if (!res.ok) throw new Error(json.error ?? "Erro ao buscar worklogs.")
        return json
      })
      .then((data) => {
        if (!cancelled) {
          setWorklogs(data.worklogs ?? [])
          setMonthLabel(data.month ?? "")
          setEditMap(buildInitialEditState(data.worklogs ?? []))
          setWorklogsLoading(false)
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : "Erro ao buscar worklogs."
          if (msg === "CLOCKWORK_NOT_CONFIGURED") {
            setWorklogsError("Clockwork não configurado. Adicione o token em Configurações → Clockwork.")
          } else {
            setWorklogsError(msg)
          }
          setWorklogs([])
          setEditMap(new Map())
          setWorklogsLoading(false)
        }
      })

    return () => { cancelled = true }
  }, [selectedUserId])

  // ── Edit handlers ────────────────────────────────────────────────────────────

  function updateEdit(id: string, patch: Partial<EditState>) {
    setEditMap((prev) => {
      const next = new Map(prev)
      const cur = next.get(id)
      if (!cur) return prev
      next.set(id, { ...cur, ...patch })
      return next
    })
  }

  async function saveWorklog(worklog: CwWorklog, state: EditState) {
    const dateKey = spDateKey(worklog.started)
    const seconds = deriveSeconds(state.startHHmm, state.endHHmm)

    if (seconds === null) {
      updateEdit(worklog.id, {
        saveError: "Horário inválido: verifique início e fim.",
        saving: false,
      })
      return
    }

    const newStarted = spToUtcIso(dateKey, state.startHHmm)

    updateEdit(worklog.id, { saving: true, saveError: null })

    try {
      const res = await fetch("/api/clockwork/worklogs", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          worklogId: worklog.id,
          started: newStarted,
          timeSpentSeconds: seconds,
          comment: state.comment,
        }),
      })

      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(json.error ?? `Erro ${res.status}`)
      }

      // Update local worklog data to reflect saved values
      setWorklogs((prev) =>
        prev.map((w) =>
          w.id === worklog.id
            ? { ...w, started: newStarted, timeSpentSeconds: seconds, comment: state.comment }
            : w,
        ),
      )
      updateEdit(worklog.id, { saving: false, saveError: null })
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao salvar."
      updateEdit(worklog.id, { saving: false, saveError: msg })
    }
  }

  // ── Derived data ─────────────────────────────────────────────────────────────

  const grouped = React.useMemo(() => groupByDate(worklogs), [worklogs])

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4">
      {/* Controls bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Avatar strip */}
        <div className="min-w-0 flex-1">
          {!membrosLoading && membros.length > 0 && (
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

        {/* Profile filter */}
        {canFilterByProfile && (
          <div className="flex shrink-0 items-center gap-2">
            <Select
              value={profileFilter}
              onValueChange={(v) => v && handleProfileChange(v as Exclude<AccessProfileId, "MGR">)}
            >
              <SelectTrigger className="w-36" aria-label="Filtrar por perfil">
                <SelectValue />
              </SelectTrigger>
              <SelectPopup>
                {ALL_PROFILE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectPopup>
            </Select>
          </div>
        )}
      </div>

      {/* Content */}
      {membrosLoading ? (
        <SectionSpinner minHeight="min-h-[20rem]" />
      ) : membros.length === 0 ? (
        <EmptyState message="Nenhum membro encontrado neste perfil." />
      ) : worklogsLoading ? (
        <SectionSpinner minHeight="min-h-[20rem]" />
      ) : worklogsError ? (
        <div className="flex items-center justify-center rounded-custom border border-border-default bg-surface-card py-16 shadow-card px-4">
          <p className="text-center text-sm text-destructive">{worklogsError}</p>
        </div>
      ) : worklogs.length === 0 ? (
        <EmptyState
          message={
            monthLabel
              ? `Nenhum worklog registrado em ${monthLabel}.`
              : "Nenhum worklog registrado no mês atual."
          }
        />
      ) : (
        <div className="flex flex-col gap-6">
          {monthLabel && (
            <p className="text-sm font-medium text-text-secondary capitalize">{monthLabel}</p>
          )}
          {grouped.map((day) => (
            <DayGroup
              key={day.dateKey}
              day={day}
              editMap={editMap}
              onFieldChange={(id, field, value) => updateEdit(id, { [field]: value, saveError: null })}
              onBlurSave={(worklog, state) => saveWorklog(worklog, state)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── DayGroup component ────────────────────────────────────────────────────────

export interface DayGroupProps {
  day: GroupedDay
  editMap: Map<string, EditState>
  onFieldChange: (id: string, field: keyof Pick<EditState, "startHHmm" | "endHHmm" | "comment">, value: string) => void
  onBlurSave: (worklog: CwWorklog, state: EditState) => void
}

export function DayGroup({ day, editMap, onFieldChange, onBlurSave }: DayGroupProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-border-default bg-surface-card shadow-card">
      {/* Day header */}
      <div className="flex items-baseline justify-between border-b border-border-default bg-neutral-grey-50 px-4 py-3">
        <h3 className="text-sm font-semibold text-text-primary">{day.label}</h3>
        <span className="ml-4 shrink-0 text-xs font-medium text-text-secondary tabular-nums">
          {formatDuration(day.totalSeconds)} total
        </span>
      </div>

      {/* Scrollable table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border-default">
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-secondary w-[7rem]">
                Jira
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-secondary">
                Descrição
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-secondary w-[6.5rem]">
                Início
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-secondary w-[6.5rem]">
                Fim
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-secondary w-[5rem]">
                Total
              </th>
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
                />
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── WorklogRow component ──────────────────────────────────────────────────────

interface WorklogRowProps {
  worklog: CwWorklog
  state: EditState
  totalSeconds: number | null
  onFieldChange: (id: string, field: keyof Pick<EditState, "startHHmm" | "endHHmm" | "comment">, value: string) => void
  onBlurSave: (worklog: CwWorklog, state: EditState) => void
}

function WorklogRow({ worklog, state, totalSeconds, onFieldChange, onBlurSave }: WorklogRowProps) {
  // Track if any field is dirty relative to last save
  const lastSavedRef = React.useRef({
    startHHmm: state.startHHmm,
    endHHmm: state.endHHmm,
    comment: state.comment,
  })

  function handleBlur() {
    const { startHHmm, endHHmm, comment } = state
    const last = lastSavedRef.current
    const changed =
      startHHmm !== last.startHHmm ||
      endHHmm !== last.endHHmm ||
      comment !== last.comment

    if (!changed || state.saving) return
    lastSavedRef.current = { startHHmm, endHHmm, comment }
    onBlurSave(worklog, state)
  }

  const timeInputClass = cn(
    "w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-sm tabular-nums text-text-primary",
    "hover:border-border-default focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary/40",
    "transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
    state.saving && "opacity-50 pointer-events-none",
  )

  return (
    <>
      <tr className="border-b border-border-default last:border-b-0 transition-colors hover:bg-surface-hover">
        <td className="px-4 py-2.5">
          <span className="font-mono text-xs font-medium text-brand-primary">
            {worklog.issueKey}
          </span>
        </td>
        <td className="px-4 py-2.5">
          <input
            type="text"
            value={state.comment}
            disabled={state.saving}
            aria-label={`Descrição do lançamento ${worklog.issueKey}`}
            onChange={(e) => onFieldChange(worklog.id, "comment", e.target.value)}
            onBlur={handleBlur}
            className={cn(
              "w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-sm text-text-primary",
              "hover:border-border-default focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary/40",
              "transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
              state.saving && "opacity-50 pointer-events-none",
            )}
            placeholder="Sem descrição"
          />
        </td>
        <td className="px-4 py-2.5">
          <input
            type="time"
            value={state.startHHmm}
            disabled={state.saving}
            aria-label={`Horário de início do lançamento ${worklog.issueKey}`}
            onChange={(e) => onFieldChange(worklog.id, "startHHmm", e.target.value)}
            onBlur={handleBlur}
            className={timeInputClass}
          />
        </td>
        <td className="px-4 py-2.5">
          <input
            type="time"
            value={state.endHHmm}
            disabled={state.saving}
            aria-label={`Horário de fim do lançamento ${worklog.issueKey}`}
            onChange={(e) => onFieldChange(worklog.id, "endHHmm", e.target.value)}
            onBlur={handleBlur}
            className={timeInputClass}
          />
        </td>
        <td className="px-4 py-2.5">
          {state.saving ? (
            <span className="text-xs text-text-secondary animate-pulse">Salvando…</span>
          ) : (
            <span
              className={cn(
                "text-xs font-medium tabular-nums",
                totalSeconds == null || totalSeconds <= 0
                  ? "text-destructive"
                  : "text-text-primary",
              )}
            >
              {totalSeconds != null && totalSeconds > 0 ? formatDuration(totalSeconds) : "—"}
            </span>
          )}
        </td>
      </tr>
      {state.saveError && (
        <tr>
          <td colSpan={5} className="px-4 pb-2 pt-0">
            <p className="text-xs text-destructive">{state.saveError}</p>
          </td>
        </tr>
      )}
    </>
  )
}
