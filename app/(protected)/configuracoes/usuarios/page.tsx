import { auth } from "@/lib/auth"
import { getQaUsers } from "@/lib/actions/usuarios"
import { checkIsAdmin } from "@/lib/session"
import UsuariosClient from "./UsuariosClient"

// Always render fresh — Google OAuth creates users at login time and must appear immediately
export const dynamic = "force-dynamic"

export default async function UsuariosPage() {
  const [users, session, isAdmin] = await Promise.all([getQaUsers(), auth(), checkIsAdmin()])

  let currentUserId: string | null = null
  if (session?.user?.email) {
    const sessionEmail = session.user.email.toLowerCase()
    const match = users.find((u) => u.email.toLowerCase() === sessionEmail)
    currentUserId = match?.id ?? null
  }

  return <UsuariosClient initialUsers={users} currentUserId={currentUserId} isAdmin={isAdmin} />
}
