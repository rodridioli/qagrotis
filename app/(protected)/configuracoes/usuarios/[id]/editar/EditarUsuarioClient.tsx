"use client"

import React from "react"
import { useSession } from "next-auth/react"
import { type QaUserProfile } from "@/lib/actions/usuarios"
import { type AccessProfile } from "@/lib/rbac/policy"
import UsuarioFormTabs from "../../UsuarioFormTabs"

interface Props {
  id: string
  initialProfile: QaUserProfile
  isAdmin: boolean
  canEditSensitive: boolean
  manageableProfiles: AccessProfile[]
}

export default function EditarUsuarioClient({ id, initialProfile, manageableProfiles }: Props) {
  const { data: session } = useSession()

  return (
    <UsuarioFormTabs
      mode="edit"
      userId={id}
      initialData={initialProfile}
      manageableProfiles={manageableProfiles}
      sessionUser={session?.user as any}
    />
  )
}
