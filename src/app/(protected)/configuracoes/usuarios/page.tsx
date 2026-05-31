import { auth } from "@/core/auth"
import { getQaUsers } from "@/features/usuarios/actions/usuarios"
import { checkIsAdmin } from "@/core/session"
import { getTeamMemberIds } from "@/features/equipe/actions/equipes"
import { serializeRscProps } from "@/core/rsc-serialize"
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
  const isMgrAdmin =
    session?.user?.type === "Administrador" && session?.user?.accessProfile === "MGR"

  // RBAC: Admin+MGR vê todos; Admin+QA/UX/TW vê apenas membros da sua equipe.
  const viewerType = session?.user?.type ?? null
  const restrictToTeam =
    viewerType === "Administrador" &&
    session?.user?.accessProfile !== null &&
    session?.user?.accessProfile !== "MGR"

  let allowedUserIds: string[] | null = null
  if (restrictToTeam && session?.user?.id) {
    const memberIds = await getTeamMemberIds(session.user.id)
    allowedUserIds = [session.user.id, ...memberIds]
  }

  const users = allowedUserIds
    ? allUsers.filter((u) => allowedUserIds!.includes(u.id))
    : allUsers

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
      isMgrAdmin={isMgrAdmin}
      canHardDelete={isMgrAdmin}
      allowedUserIds={serializeRscProps(allowedUserIds)}
      usersFetchFailed={usersFetchFailed}
      usersFetchErrorMessage={usersFetchErrorMessage}
    />
  )
}
