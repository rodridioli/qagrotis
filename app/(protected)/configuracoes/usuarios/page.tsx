import { auth } from "@/lib/auth"
import { getQaUsers } from "@/lib/actions/usuarios"
import { checkIsAdmin } from "@/lib/session"
import { serializeRscProps } from "@/lib/rsc-serialize"
import { type AccessProfile } from "@/lib/rbac/policy"
import UsuariosClient from "./UsuariosClient"

// Always render fresh — Google OAuth creates users at login time and must appear immediately
export const dynamic = "force-dynamic"

export default async function UsuariosPage() {
  const [rUsers, rSession, rAdmin] = await Promise.allSettled([
    getQaUsers(),
    auth(),
    checkIsAdmin(),
  ])

  const allUsers = rUsers.status === "fulfilled" ? rUsers.value : []
  const session = rSession.status === "fulfilled" ? rSession.value : null
  const isAdmin = rAdmin.status === "fulfilled" ? rAdmin.value : false

  // RBAC: Admin+QA/UX/TW só vê usuários do próprio perfil; Admin+MGR vê todos.
  const viewerType = session?.user?.type ?? null
  const viewerProfile = (session?.user?.accessProfile ?? null) as AccessProfile | null
  const restrictByProfile =
    viewerType === "Administrador" &&
    viewerProfile !== null &&
    viewerProfile !== "MGR"
  /** QA: inclui cadastros sem perfil gravado (legado = QA). UX/TW: apenas perfil explícito. */
  const users =
    restrictByProfile && viewerProfile
      ? viewerProfile === "QA"
        ? allUsers.filter((u) => (u.accessProfile ?? "QA") === "QA")
        : allUsers.filter((u) => u.accessProfile === viewerProfile)
      : allUsers
  const listProfileFilter =
    restrictByProfile && viewerProfile ? viewerProfile : null

  if (rUsers.status === "rejected") {
    console.error("[usuarios/page] getQaUsers:", rUsers.reason)
  }
  if (rSession.status === "rejected") {
    console.error("[usuarios/page] auth:", rSession.reason)
  }
  if (rAdmin.status === "rejected") {
    console.error("[usuarios/page] checkIsAdmin:", rAdmin.reason)
  }

  let currentUserId: string | null = null
  if (session?.user?.email) {
    const sessionEmail = session.user.email.toLowerCase()
    const match = users.find((u) => u.email.toLowerCase() === sessionEmail)
    currentUserId = match?.id ?? null
  }

  const usersFetchFailed = rUsers.status === "rejected"
  const usersFetchErrorMessage =
    rUsers.status === "rejected"
      ? rUsers.reason instanceof Error
        ? rUsers.reason.message
        : String(rUsers.reason)
      : null

  return (
    <UsuariosClient
      initialUsers={serializeRscProps(users)}
      currentUserId={currentUserId}
      isAdmin={isAdmin}
      listProfileFilter={listProfileFilter}
      usersFetchFailed={usersFetchFailed}
      usersFetchErrorMessage={usersFetchErrorMessage}
    />
  )
}
