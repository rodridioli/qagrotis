"use client"

import { IndividualActiveUserAvatarStrip, type IndividualAvatarUser } from "./IndividualActiveUserAvatarStrip"
import { IndividualAvaliacoesSection } from "@/components/individual/IndividualAvaliacoesSection"

interface Props {
  secao: string
  users: IndividualAvatarUser[]
  selectedUserId: string
}

export function IndividualSecaoDevelopmentPanel({
  secao,
  users,
  selectedUserId,
}: Props) {
  const showAvaliacoes = secao === "avaliacoes"

  return (
    <div className="flex min-h-[min(70vh,36rem)] w-full flex-col items-stretch gap-8">
      {users.length > 0 ? (
        <IndividualActiveUserAvatarStrip secao={secao} users={users} selectedUserId={selectedUserId} />
      ) : null}
      {showAvaliacoes ? (
        <IndividualAvaliacoesSection evaluatedUserId={selectedUserId} />
      ) : (
        <div className="flex w-full flex-1 flex-col items-center justify-center py-16">
          <p className="text-center text-base text-text-secondary">Em desenvolvimento.</p>
        </div>
      )}
    </div>
  )
}
