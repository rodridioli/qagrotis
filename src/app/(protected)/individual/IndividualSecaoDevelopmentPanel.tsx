"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { IndividualActiveUserAvatarStrip, type IndividualAvatarUser } from "./IndividualActiveUserAvatarStrip"
import { IndividualAvaliacoesSection } from "@/features/individual/components/IndividualAvaliacoesSection"
import { IndividualFeedbacksSection } from "@/features/individual/components/IndividualFeedbacksSection"
import { ConquistasSection } from "@/features/individual/components/ConquistasSection"
import { ProgressaoSection, type ProgressaoSectionHandle } from "@/features/individual/components/ProgressaoSection"
import { IndividualLancamentosSection } from "@/features/individual/components/IndividualLancamentosSection"

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

  const showAvaliacoes = secao === "avaliacoes"
  const showFeedbacks  = secao === "feedbacks"
  const showConquistas = secao === "conquistas"
  const showProgressao = secao === "progressao"
  const showLancamentos = secao === "lancamentos" && canAccessLancamentos

  return (
    <div className="flex min-h-[min(70vh,36rem)] w-full flex-col items-stretch gap-8">
      {users.length > 0 ? (
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <IndividualActiveUserAvatarStrip secao={secao} users={users} selectedUserId={selectedUserId} />
          </div>
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
        <IndividualLancamentosSection evaluatedUserId={selectedUserId} />
      ) : (
        <div className="flex w-full flex-1 flex-col items-center justify-center py-16">
          <p className="text-center text-base text-text-secondary">Em desenvolvimento.</p>
        </div>
      )}
    </div>
  )
}
