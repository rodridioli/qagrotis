"use client"

import * as React from "react"
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

const ALL_PROFILE_OPTIONS: { value: AccessProfileId; label: string }[] = [
  { value: "QA",  label: "QA"      },
  { value: "UX",  label: "UX"      },
  { value: "TW",  label: "TW"      },
  { value: "MGR", label: "Manager" },
]

const AVATAR_SIZE = 44

interface Props {
  userAccessProfile: AccessProfileId
  canFilterByProfile: boolean
}

export function EquipeLancamentosSection({ userAccessProfile, canFilterByProfile }: Props) {
  const [profileFilter, setProfileFilter] = React.useState<AccessProfileId>(userAccessProfile)
  const [membros, setMembros] = React.useState<EquipeMembroLancamentos[]>([])
  const [loading, setLoading] = React.useState(true)
  const [selectedUserId, setSelectedUserId] = React.useState<string | null>(null)
  const [preset, setPreset] = React.useState<LancamentosPeriodPreset>("week")

  const isViewerMgr = userAccessProfile === "MGR"

  // Viewers não-MGR não veem a opção Manager no dropdown
  const profileOptions = isViewerMgr
    ? ALL_PROFILE_OPTIONS
    : ALL_PROFILE_OPTIONS.filter((o) => o.value !== "MGR")

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    setSelectedUserId(null)
    const profile = canFilterByProfile ? profileFilter : userAccessProfile
    getEquipeMembrosParaLancamentos(profile).then((data) => {
      if (!cancelled) {
        // Viewers não-MGR não veem avatares de membros MGR
        const visible = isViewerMgr ? data : data.filter((m) => m.accessProfile !== "MGR")
        setMembros(visible)
        setSelectedUserId(visible[0]?.userId ?? null)
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [profileFilter, canFilterByProfile, userAccessProfile, isViewerMgr])

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
                            onClick={() => setSelectedUserId(m.userId)}
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
              onValueChange={(v) => v && setProfileFilter(v as AccessProfileId)}
            >
              <SelectTrigger className="w-36" aria-label="Filtrar por perfil">
                <SelectValue />
              </SelectTrigger>
              <SelectPopup>
                {profileOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectPopup>
            </Select>
          )}

          <Select
            value={preset}
            onValueChange={(v) => v && setPreset(v as LancamentosPeriodPreset)}
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
          evaluatedUserId={selectedUserId}
          evaluatedUserAccessProfile={
            (membros.find((m) => m.userId === selectedUserId)?.accessProfile as "QA" | "UX" | "TW" | "MGR" | null) ?? null
          }
          preset={preset}
          onPresetChange={setPreset}
        />
      ) : null}
    </div>
  )
}
