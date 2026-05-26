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
import { IndividualLancamentosSection } from "@/features/individual/components/IndividualLancamentosSection"
import { UserAvatar } from "@/features/equipe/components/EquipePerformanceCard"
import {
  getLancamentosPresetLabel,
  LANCAMENTOS_PRESET_OPTIONS,
  type LancamentosPeriodPreset,
} from "@/features/individual/lib/individual-lancamentos-date-presets"
import { cn } from "@/core/utils"
import {
  getEquipeMembrosParaLancamentos,
  type EquipeMembroLancamentos,
} from "@/features/equipe/actions/equipe"

type AccessProfileId = "QA" | "UX" | "TW" | "MGR"

const VALID_PROFILES = new Set<string>(["QA", "UX", "TW"])
const VALID_PRESETS = new Set<string>(["today", "anterior", "week", "lastWeek", "month", "lastMonth"])

const ALL_PROFILE_OPTIONS: { value: Exclude<AccessProfileId, "MGR">; label: string }[] = [
  { value: "QA", label: "QA" },
  { value: "UX", label: "UX" },
  { value: "TW", label: "TW" },
]

const AVATAR_SIZE = 38

interface Props {
  userAccessProfile: AccessProfileId
  canFilterByProfile: boolean
}

export function EquipeLancamentosSection({ userAccessProfile, canFilterByProfile }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // MGR não tem lançamentos próprios — default para QA
  const defaultProfile: Exclude<AccessProfileId, "MGR"> =
    userAccessProfile === "MGR" ? "QA" : userAccessProfile as Exclude<AccessProfileId, "MGR">

  const [profileFilter, setProfileFilter] = React.useState<Exclude<AccessProfileId, "MGR">>(() => {
    const v = searchParams.get("lp")
    return v && VALID_PROFILES.has(v) ? (v as Exclude<AccessProfileId, "MGR">) : defaultProfile
  })
  const [preset, setPreset] = React.useState<LancamentosPeriodPreset>(() => {
    const v = searchParams.get("periodo")
    return v && VALID_PRESETS.has(v) ? (v as LancamentosPeriodPreset) : "anterior"
  })
  const [membros, setMembros] = React.useState<EquipeMembroLancamentos[]>([])
  const [loading, setLoading] = React.useState(true)
  const [selectedUserId, setSelectedUserId] = React.useState<string | null>(null)

  // Captured once so member-load effect doesn't re-run when URL changes
  const initialMembroRef = React.useRef(searchParams.get("membro"))

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set(key, value)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  function handleProfileChange(v: Exclude<AccessProfileId, "MGR">) {
    setProfileFilter(v)
    setParam("lp", v)
  }

  function handlePresetChange(v: LancamentosPeriodPreset) {
    setPreset(v)
    setParam("periodo", v)
  }

  function handleMemberSelect(userId: string) {
    setSelectedUserId(userId)
    setParam("membro", userId)
  }

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    setSelectedUserId(null)
    const profile = canFilterByProfile ? profileFilter : userAccessProfile
    getEquipeMembrosParaLancamentos(profile).then((data) => {
      if (!cancelled) {
        // Lançamentos exibe apenas perfis QA, UX e TW
        const visible = data.filter((m) => m.accessProfile !== "MGR")
        setMembros(visible)
        // Restore member from URL on first load; fall back to first member on profile changes
        const urlMembro = initialMembroRef.current
        const match = urlMembro ? visible.find((m) => m.userId === urlMembro) : null
        setSelectedUserId(match ? match.userId : (visible[0]?.userId ?? null))
        initialMembroRef.current = null
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [profileFilter, canFilterByProfile, userAccessProfile])

  return (
    <div className="flex flex-col gap-4">
      {/* Barra de controles — sempre visível */}
      <div className="flex items-center justify-between gap-4">
        {/* Avatar strip — só renderiza quando carregado */}
        <div className="min-w-0 flex-1">
          {!loading && membros.length > 0 && (
            <TooltipProvider delay={0} closeDelay={0}>
              <div
                className="flex w-full flex-wrap items-center justify-start gap-y-2 pl-2"
                role="toolbar"
                aria-label="Selecionar membro para visualizar lançamentos"
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

        {/* Selects — sempre visíveis */}
        <div className="flex shrink-0 items-center gap-2">
          {canFilterByProfile && (
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
          )}

          <Select
            value={preset}
            onValueChange={(v) => v && handlePresetChange(v as LancamentosPeriodPreset)}
          >
            <SelectTrigger className="w-44" aria-label="Período">
              <SelectValue>{getLancamentosPresetLabel(preset)}</SelectValue>
            </SelectTrigger>
            <SelectPopup>
              {LANCAMENTOS_PRESET_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectPopup>
          </Select>
        </div>
      </div>

      {/* Área de conteúdo */}
      {loading ? (
        <SectionSpinner minHeight="min-h-[20rem]" />
      ) : membros.length === 0 ? (
        <EmptyState message="Nenhum membro encontrado neste perfil." />
      ) : selectedUserId ? (
        <IndividualLancamentosSection
          key={selectedUserId}
          evaluatedUserId={selectedUserId}
          evaluatedUserAccessProfile={
            (membros.find((m) => m.userId === selectedUserId)?.accessProfile as "QA" | "UX" | "TW" | "MGR" | null) ?? null
          }
          preset={preset}
          onPresetChange={handlePresetChange}
        />
      ) : null}
    </div>
  )
}
