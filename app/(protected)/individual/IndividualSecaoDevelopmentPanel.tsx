"use client"

import { IndividualActiveUserAvatarStrip, type IndividualAvatarUser } from "./IndividualActiveUserAvatarStrip"

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
  return (
    <div className="flex min-h-[min(70vh,36rem)] w-full flex-col items-center gap-8">
      {users.length > 0 ? (
        <IndividualActiveUserAvatarStrip secao={secao} users={users} selectedUserId={selectedUserId} />
      ) : null}
      <div className="flex w-full flex-1 flex-col items-center justify-center py-16">
        <p className="text-center text-base text-text-secondary">Em desenvolvimento.</p>
      </div>
    </div>
  )
}
