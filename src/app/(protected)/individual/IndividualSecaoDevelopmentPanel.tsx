"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  getLancamentosPresetLabel,
  LANCAMENTOS_PRESET_OPTIONS,
  type LancamentosPeriodPreset,
} from "@/features/individual/lib/individual-lancamentos-date-presets"
import { IndividualActiveUserAvatarStrip, type IndividualAvatarUser } from "./IndividualActiveUserAvatarStrip"
import { IndividualAvaliacoesSection } from "@/features/individual/components/IndividualAvaliacoesSection"
import { IndividualFeedbacksSection } from "@/features/individual/components/IndividualFeedbacksSection"
import { ConquistasSection } from "@/features/individual/components/ConquistasSection"
import { ProgressaoSection, type ProgressaoSectionHandle } from "@/features/individual/components/ProgressaoSection"
import { IndividualLancamentosSection } from "@/features/individual/components/IndividualLancamentosSection"

type AccessProfileFilter = "all" | "QA" | "UX" | "TW" | "MGR"

const ACCESS_PROFILE_OPTIONS: { value: AccessProfileFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "QA",  label: "QA" },
  { value: "UX",  label: "UX" },
  { value: "TW",  label: "TW" },
  { value: "MGR", label: "Manager" },
]

interface Props {
  secao: string
  users: IndividualAvatarUser[]
  selectedUserId: string
  isAdministradorMgr?: boolean
  /** RBAC: só utilizadores com `individual.lancamentos` devem ver a secção. */
  canAccessLancamentos?: boolean
  showCompletedToast?: boolean
}

export function IndividualSecaoDevelopmentPanel({
  secao,
  users,
  selectedUserId,
  isAdministradorMgr = false,
  canAccessLancamentos = false,
  showCompletedToast = false,
}: Props) {
  const router = useRouter()
  const progressaoRef = React.useRef<ProgressaoSectionHandle>(null)
  const [lancamentosPreset, setLancamentosPreset] = React.useState<LancamentosPeriodPreset>("week")
  const [accessProfileFilter, setAccessProfileFilter] = React.useState<AccessProfileFilter>("all")
  const [pendingUserId, setPendingUserId] = React.useState<string | null>(null)

  // Optimistic effective user: reflects the navigation target immediately,
  // before the server-rendered prop catches up.
  const effectiveUserId = pendingUserId ?? selectedUserId

  // Clear pending once the server prop confirms the navigation completed.
  React.useEffect(() => {
    if (pendingUserId !== null && selectedUserId === pendingUserId) {
      setPendingUserId(null)
    }
  }, [selectedUserId, pendingUserId])

  const showAvaliacoes = secao === "avaliacoes"
  const showFeedbacks  = secao === "feedbacks"
  const showConquistas = secao === "conquistas"
  const showProgressao = secao === "progressao"
  const showLancamentos = secao === "lancamentos" && canAccessLancamentos

  const visibleUsers = React.useMemo(() => {
    if (accessProfileFilter === "all") return users
    return users.filter((u) => u.accessProfile === accessProfileFilter)
  }, [users, accessProfileFilter])

  function handleAccessProfileChange(value: AccessProfileFilter) {
    const newVisible =
      value === "all" ? users : users.filter((u) => u.accessProfile === value)
    setAccessProfileFilter(value)
    if (newVisible.length > 0 && !newVisible.some((u) => u.id === selectedUserId)) {
      const firstId = newVisible[0]!.id
      setPendingUserId(firstId)
      router.replace(
        `/individual/lancamentos?userId=${encodeURIComponent(firstId)}`,
      )
    }
  }

  function handlePresetChange(p: LancamentosPeriodPreset) {
    setLancamentosPreset(p)
  }

  return (
    <div className="flex min-h-[min(70vh,36rem)] w-full flex-col items-stretch gap-8">
      {users.length > 0 ? (
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <IndividualActiveUserAvatarStrip secao={secao} users={visibleUsers} selectedUserId={effectiveUserId} />
          </div>
          {showLancamentos && (
            <div className="flex shrink-0 items-center" style={{ gap: "calc(var(--spacing) * 2)" }}>
              <Select
                value={accessProfileFilter}
                onValueChange={(v) => handleAccessProfileChange(v as AccessProfileFilter)}
                aria-label="Perfil de Acesso"
              >
                <SelectTrigger className="w-36">
                  <SelectValue>
                    {ACCESS_PROFILE_OPTIONS.find((o) => o.value === accessProfileFilter)?.label ?? "Todos"}
                  </SelectValue>
                </SelectTrigger>
                <SelectPopup>
                  {ACCESS_PROFILE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectPopup>
              </Select>
              <Select
                value={lancamentosPreset}
                onValueChange={(v) => handlePresetChange(v as LancamentosPeriodPreset)}
                aria-label="Período"
              >
                <SelectTrigger className="w-44">
                  <SelectValue>{getLancamentosPresetLabel(lancamentosPreset)}</SelectValue>
                </SelectTrigger>
                <SelectPopup>
                  {LANCAMENTOS_PRESET_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectPopup>
              </Select>
            </div>
          )}
          {showAvaliacoes ? (
            <Button
              type="button"
              className="shrink-0 gap-2"
              onClick={() =>
                router.push(`/individual/avaliacoes/nova?userId=${encodeURIComponent(selectedUserId)}`)
              }
            >
              <Plus className="size-4" aria-hidden />
              Adicionar Avaliação
            </Button>
          ) : null}
          {showFeedbacks ? (
            <Button
              type="button"
              className="shrink-0 gap-2"
              onClick={() =>
                router.push(`/individual/feedbacks/nova?userId=${encodeURIComponent(selectedUserId)}`)
              }
            >
              <Plus className="size-4" aria-hidden />
              Adicionar Feedback
            </Button>
          ) : null}
          {showProgressao ? (
            <Button
              type="button"
              className="shrink-0 gap-2"
              onClick={() => progressaoRef.current?.openAdd()}
            >
              <Plus className="size-4" aria-hidden />
              Adicionar Progressão
            </Button>
          ) : null}
        </div>
      ) : null}

      {showAvaliacoes ? (
        <IndividualAvaliacoesSection
          evaluatedUserId={selectedUserId}
          useMgrListEmptyChrome={isAdministradorMgr}
          showCompletedToast={showCompletedToast}
        />
      ) : showFeedbacks ? (
        <IndividualFeedbacksSection
          evaluatedUserId={selectedUserId}
          showCompletedToast={showCompletedToast}
        />
      ) : showConquistas ? (
        <ConquistasSection evaluatedUserId={selectedUserId} />
      ) : showProgressao ? (
        <ProgressaoSection ref={progressaoRef} evaluatedUserId={selectedUserId} />
      ) : showLancamentos ? (
        <IndividualLancamentosSection
          evaluatedUserId={effectiveUserId}
          preset={lancamentosPreset}
          onPresetChange={handlePresetChange}
        />
      ) : (
        <div className="flex w-full flex-1 flex-col items-center justify-center py-16">
          <p className="text-center text-base text-text-secondary">Em desenvolvimento.</p>
        </div>
      )}
    </div>
  )
}
