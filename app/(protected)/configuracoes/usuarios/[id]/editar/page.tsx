import { notFound } from "next/navigation"
import { getQaUserProfile } from "@/lib/actions/usuarios"
import { checkIsAdmin } from "@/lib/session"
import EditarUsuarioClient from "./EditarUsuarioClient"

export default async function EditarUsuarioPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [profile, isAdmin] = await Promise.all([getQaUserProfile(id), checkIsAdmin()])
  if (!profile) notFound()

  return (
    <EditarUsuarioClient
      id={id}
      initialProfile={profile}
      isAdmin={isAdmin}
    />
  )
}
