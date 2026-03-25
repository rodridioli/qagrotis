import { auth } from "@/lib/auth"
import { getQaUsers } from "@/lib/actions/usuarios"
import { MOCK_USERS } from "@/lib/qagrotis-constants"
import UsuariosClient from "./UsuariosClient"

export default async function UsuariosPage() {
  const [users, session] = await Promise.all([getQaUsers(), auth()])

  let currentUserId: string | null = null

  if (session?.user?.email) {
    const match = MOCK_USERS.find(
      (u) => u.email.toLowerCase() === session.user!.email!.toLowerCase()
    )
    currentUserId = match?.id ?? null
  }

  return <UsuariosClient initialUsers={users} currentUserId={currentUserId} />
}
