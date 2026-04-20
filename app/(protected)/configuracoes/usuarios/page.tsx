import { auth } from "@/lib/auth"
import { getQaUsers } from "@/lib/actions/usuarios"
import { checkIsAdmin } from "@/lib/session"
import { serializeRscProps } from "@/lib/rsc-serialize"
import UsuariosClient from "./UsuariosClient"

// Always render fresh — Google OAuth creates users at login time and must appear immediately
export const dynamic = "force-dynamic"

export default async function UsuariosPage() {
  const [rUsers, rSession, rAdmin] = await Promise.allSettled([
    getQaUsers(),
    auth(),
    checkIsAdmin(),
  ])

  const users = rUsers.status === "fulfilled" ? rUsers.value : []
  const session = rSession.status === "fulfilled" ? rSession.value : null
  const isAdmin = rAdmin.status === "fulfilled" ? rAdmin.value : false

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

  return (
    <UsuariosClient
      initialUsers={serializeRscProps(users)}
      currentUserId={currentUserId}
      isAdmin={isAdmin}
    />
  )
}
