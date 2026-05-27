"use client"

import React from "react"
import { useSession } from "next-auth/react"
import { type QaUserProfile } from "@/features/usuarios/actions/usuarios"
import { type AccessProfile } from "@/core/rbac/policy"
import UsuarioFormTabs from "../../UsuarioFormTabs"

interface Props {
  id: string
  initialProfile: QaUserProfile
  isAdmin: boolean
  canEditSensitive: boolean
  manageableProfiles: AccessProfile[]
  readOnly?: boolean
}

export default function EditarUsuarioClient({ id, initialProfile, manageableProfiles, readOnly }: Props) {
  const { data: session } = useSession()

  return (
    <UsuarioFormTabs
      mode="edit"
      userId={id}
      initialData={initialProfile}
      manageableProfiles={manageableProfiles}
      readOnly={readOnly}
      sessionUser={
        session?.user?.id
          ? {
              id: session.user.id,
              type: session.user.type ?? "Padrão",
              accessProfile: session.user.accessProfile,
            }
          : undefined
      }
    />
  )
}
