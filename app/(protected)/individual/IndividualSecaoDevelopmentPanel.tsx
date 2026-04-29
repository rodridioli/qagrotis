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
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-8 rounded-xl bg-surface-card p-8 shadow-card">
      {users.length > 0 ? (
        <IndividualActiveUserAvatarStrip secao={secao} users={users} selectedUserId={selectedUserId} />
      ) : null}
      <p className="text-center text-base text-text-secondary">Em desenvolvimento.</p>
    </div>
  )
}
