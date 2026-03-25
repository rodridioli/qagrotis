import { auth } from "@/lib/auth"
import { getModulos } from "@/lib/actions/modulos"
import { MOCK_USERS } from "@/lib/qagrotis-constants"
import ModulosClient from "./ModulosClient"

export default async function ModulosPage() {
  const [modulos, session] = await Promise.all([getModulos(), auth()])

  let isAdmin = true
  if (session?.user?.email) {
    const u = MOCK_USERS.find(
      (u) => u.email.toLowerCase() === session.user!.email!.toLowerCase()
    )
    if (u) isAdmin = u.type === "Administrador"
  }

  return <ModulosClient initialModulos={modulos} isAdmin={isAdmin} />
}
