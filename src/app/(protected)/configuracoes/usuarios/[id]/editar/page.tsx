export const metadata = { title: "Editar usuário" }

import { notFound, redirect } from "next/navigation"
import { getQaUserProfile } from "@/features/usuarios/actions/usuarios"
import { checkIsAdmin } from "@/core/session"
import { auth } from "@/core/auth"
import { buildRole, canEditUserField, manageableProfiles, type AccessProfile } from "@/core/rbac/policy"
import EditarUsuarioClient from "./EditarUsuarioClient"

export default async function EditarUsuarioPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [profile, isAdmin, session] = await Promise.all([
    getQaUserProfile(id),
    checkIsAdmin(),
    auth(),
  ])
  if (!profile) notFound()

  const role = buildRole(session?.user?.type, session?.user?.accessProfile)
  const isEditingSelf = (session?.user?.id ?? "") === id
  const accessProfile = session?.user?.accessProfile

  // Padrão só pode editar o próprio cadastro.
  if (!isAdmin && !isEditingSelf) redirect("/forbidden")

  // Admin não-MGR visualizando cadastro de outro usuário → modo leitura.
  const isNonMgrAdmin = isAdmin && accessProfile !== "MGR"
  const isReadOnly = isNonMgrAdmin && !isEditingSelf

  const targetProfile = (profile.accessProfile ?? null) as AccessProfile | null

  const canEditSensitive = canEditUserField(role, isEditingSelf, targetProfile)
  // Para o select de Perfil de Acesso, mostrar apenas perfis que o admin pode atribuir.
  const allowedProfiles = isEditingSelf
    ? (targetProfile ? [targetProfile] : [])
    : manageableProfiles(role)

  return (
    <EditarUsuarioClient
      id={id}
      initialProfile={profile}
      isAdmin={isAdmin}
      canEditSensitive={canEditSensitive}
      manageableProfiles={allowedProfiles}
      readOnly={isReadOnly}
    />
  )
}
