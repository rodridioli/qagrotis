import { auth } from "@/lib/auth"
import { getSistemas } from "@/lib/actions/sistemas"
import { MOCK_USERS } from "@/lib/qagrotis-constants"
import SistemasClient from "./SistemasClient"

export default async function SistemasPage() {
  const [sistemas, session] = await Promise.all([getSistemas(), auth()])

  let isAdmin = true
  if (session?.user?.email) {
    const u = MOCK_USERS.find(
      (u) => u.email.toLowerCase() === session.user!.email!.toLowerCase()
    )
    if (u) isAdmin = u.type === "Administrador"
  }

  return <SistemasClient initialSistemas={sistemas} isAdmin={isAdmin} />
}
