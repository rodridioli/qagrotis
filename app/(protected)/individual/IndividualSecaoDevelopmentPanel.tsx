"use client"

import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { IndividualActiveUserAvatarStrip, type IndividualAvatarUser } from "./IndividualActiveUserAvatarStrip"
import { IndividualAvaliacoesSection } from "@/components/individual/IndividualAvaliacoesSection"
import { IndividualFeedbacksSection } from "@/components/individual/IndividualFeedbacksSection"

interface Props {
  secao: string
  users: IndividualAvatarUser[]
  selectedUserId: string
  /** Lista de avaliações (MGR): empty state alinhado às outras listas do produto. */
  isAdministradorMgr?: boolean
  /** Quando true, dispara o toast de sucesso ao montar (redirecionamento pós-conclusão). */
  showCompletedToast?: boolean
}

export function IndividualSecaoDevelopmentPanel({
  secao,
  users,
  selectedUserId,
  isAdministradorMgr = false,
  showCompletedToast = false,
}: Props) {
  const router = useRouter()
  const showAvaliacoes = secao === "avaliacoes"
  const showFeedbacks = secao === "feedbacks"

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
                router.push(
                  `/individual/avaliacoes/nova?userId=${encodeURIComponent(selectedUserId)}`,
                )
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
                router.push(
                  `/individual/feedbacks/nova?userId=${encodeURIComponent(selectedUserId)}`,
                )
              }
            >
              <Plus className="size-4" aria-hidden />
              Adicionar Feedback
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
      ) : (
        <div className="flex w-full flex-1 flex-col items-center justify-center py-16">
          <p className="text-center text-base text-text-secondary">Em desenvolvimento.</p>
        </div>
      )}
    </div>
  )
}
