"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { Plus, Settings, Send } from "lucide-react"
import { toast } from "sonner"
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
import { IndividualFeriasSection, type IndividualFeriasSectionHandle } from "@/features/individual/components/IndividualFeriasSection"
import { IndividualAusenciasSection } from "@/features/individual/components/IndividualAusenciasSection"
import { IndividualDominioSection } from "@/features/individual/components/IndividualDominioSection"
import { DominioConfiguracaoSheet } from "@/features/individual/components/DominioConfiguracaoSheet"
import { solicitarDominioAvaliacao } from "@/features/individual/actions/individual-dominio"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"

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

  // Verifica credenciais Jira — compartilha cache com IndividualLancamentosSection
  // (mesma queryKey, staleTime: Infinity → zero chamadas extras de rede)
  const credentialsQuery = useQuery({
    queryKey: ["jira-credentials"],
    queryFn: async () => {
      const res = await fetch("/api/jira/credentials", { credentials: "same-origin" })
      if (!res.ok) return { configured: false }
      return res.json() as Promise<{ configured?: boolean }>
    },
    staleTime: Infinity,
    gcTime: Infinity,
  })
  const jiraConfigured = credentialsQuery.data?.configured ?? null

  const progressaoRef = React.useRef<ProgressaoSectionHandle>(null)
  const feriasRef = React.useRef<IndividualFeriasSectionHandle>(null)
  const [lancamentosPreset, setLancamentosPreset] = React.useState<LancamentosPeriodPreset>("week")
  const [accessProfileFilter, setAccessProfileFilter] = React.useState<AccessProfileFilter>("all")
  const [pendingUserId, setPendingUserId] = React.useState<string | null>(null)
  const [dominioConfiguracaoOpen, setDominioConfiguracaoOpen] = React.useState(false)
  const [solicitarOpen, setSolicitarOpen] = React.useState(false)
  const [solicitarLoading, setSolicitarLoading] = React.useState(false)
  const [dominioRefreshKey, setDominioRefreshKey] = React.useState(0)

  // Optimistic effective user: reflects the navigation target immediately,
  // before the server-rendered prop catches up.
  const effectiveUserId = pendingUserId ?? selectedUserId

  // Clear pending once the server prop confirms the navigation completed.
  React.useEffect(() => {
    if (pendingUserId !== null && selectedUserId === pendingUserId) {
      setPendingUserId(null)
    }
  }, [selectedUserId, pendingUserId])

  const showAvaliacoes  = secao === "avaliacoes"
  const showFeedbacks   = secao === "feedbacks"
  const showFerias      = secao === "ferias"
  const showConquistas  = secao === "conquistas"
  const showProgressao  = secao === "progressao"
  const showAusencias   = secao === "ausencias"
  const showLancamentos = secao === "lancamentos" && canAccessLancamentos
  const showDominio     = secao === "dominio"

  const visibleUsers = React.useMemo(() => {
    if (accessProfileFilter === "all") return users
    return users.filter((u) => u.accessProfile === accessProfileFilter)
  }, [users, accessProfileFilter])

  function handleAccessProfileChange(value: AccessProfileFilter) {
    const newVisible =
      value === "all" ? users : users.filter((u) => u.accessProfile === value)
    setAccessProfileFilter(value)
    if (value !== "all" && newVisible.length > 0) {
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
          {showLancamentos && jiraConfigured === true && (
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
          {showDominio && isAdministradorMgr ? (
            <div className="flex shrink-0 items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={() => setDominioConfiguracaoOpen(true)}
              >
                <Settings className="size-4" aria-hidden />
                Configurações
              </Button>
              <Button
                type="button"
                className="gap-2"
                onClick={() => setSolicitarOpen(true)}
              >
                <Send className="size-4" aria-hidden />
                Solicitar Avaliação
              </Button>
            </div>
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
          {showFerias && isAdministradorMgr ? (
            <Button
              type="button"
              className="shrink-0 gap-2"
              onClick={() => feriasRef.current?.openAdd()}
            >
              <Plus className="size-4" aria-hidden />
              Adicionar Férias
            </Button>
          ) : null}
        </div>
      ) : null}

      {showDominio ? (
        <IndividualDominioSection
          evaluatedUserId={selectedUserId}
          readOnly={!isAdministradorMgr}
          refreshKey={dominioRefreshKey}
        />
      ) : showAvaliacoes ? (
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
      ) : showFerias ? (
        <IndividualFeriasSection
          ref={feriasRef}
          evaluatedUserId={selectedUserId}
          canWrite={isAdministradorMgr}
        />
      ) : showAusencias ? (
        <IndividualAusenciasSection
          evaluatedUserId={selectedUserId}
          canWrite={isAdministradorMgr}
        />
      ) : showLancamentos ? (
        <IndividualLancamentosSection
          evaluatedUserId={effectiveUserId}
          preset={lancamentosPreset}
          onPresetChange={handlePresetChange}
          evaluatedUserAccessProfile={users.find((u) => u.id === selectedUserId)?.accessProfile}
        />
      ) : (
        <div className="flex w-full flex-1 flex-col items-center justify-center py-16">
          <p className="text-center text-base text-text-secondary">Em desenvolvimento.</p>
        </div>
      )}

      {isAdministradorMgr ? (
        <>
          <DominioConfiguracaoSheet
            open={dominioConfiguracaoOpen}
            onOpenChange={setDominioConfiguracaoOpen}
          />
          <ConfirmDialog
            open={solicitarOpen}
            onOpenChange={setSolicitarOpen}
            title="Solicitar avaliação de domínio?"
            description={`Será enviada uma notificação para o usuário selecionado pedindo que ele preencha a avaliação de domínio. O usuário só poderá fechar o formulário após concluir o preenchimento.`}
            confirmLabel={solicitarLoading ? "Solicitando…" : "Solicitar"}
            buttonVariant="default"
            onConfirm={async () => {
              setSolicitarLoading(true)
              const res = await solicitarDominioAvaliacao(selectedUserId)
              setSolicitarLoading(false)
              if (res.error) {
                toast.error(res.error)
                return
              }
              toast.success("Avaliação de domínio solicitada com sucesso.")
              setSolicitarOpen(false)
              setDominioRefreshKey((k) => k + 1)
            }}
          />
        </>
      ) : null}
    </div>
  )
}
