import { notFound } from "next/navigation"
import { getQaUserProfile } from "@/lib/actions/usuarios"
import { auth } from "@/lib/auth"
import { MOCK_USERS } from "@/lib/qagrotis-constants"
import EditarUsuarioClient from "./EditarUsuarioClient"

export default async function EditarUsuarioPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [profile, session] = await Promise.all([getQaUserProfile(id), auth()])
  if (!profile) notFound()

  const sessionEmail = session?.user?.email?.toLowerCase() ?? null
  const sessionUser = sessionEmail
    ? MOCK_USERS.find((u) => u.email.toLowerCase() === sessionEmail)
    : null
  const isAdmin = !sessionUser || sessionUser.type === "Administrador"

  return (
    <EditarUsuarioClient
      id={id}
      initialProfile={profile}
      isAdmin={isAdmin}
    />
  )
}
