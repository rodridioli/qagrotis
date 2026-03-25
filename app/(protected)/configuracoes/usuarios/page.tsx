import { auth } from "@/lib/auth"
import { getQaUsers } from "@/lib/actions/usuarios"
import UsuariosClient from "./UsuariosClient"

export default async function UsuariosPage() {
  const [users, session] = await Promise.all([getQaUsers(), auth()])

  let currentUserId: string | null = null

  if (session?.user?.email) {
    const sessionEmail = session.user.email.toLowerCase()
    const match = users.find((u) => u.email.toLowerCase() === sessionEmail)
    currentUserId = match?.id ?? null
  }

  return <UsuariosClient initialUsers={users} currentUserId={currentUserId} />
}
