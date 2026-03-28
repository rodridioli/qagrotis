import { getModulos } from "@/lib/actions/modulos"
import { getCenarios } from "@/lib/actions/cenarios"
import { getQaUsers } from "@/lib/actions/usuarios"
import { auth } from "@/lib/auth"
import { DashboardClient } from "./DashboardClient"

export default async function DashboardPage() {
  const [modulos, cenarios, users, session] = await Promise.all([
    getModulos(),
    getCenarios(),
    getQaUsers(),
    auth(),
  ])
  const currentUser = session?.user?.name ?? session?.user?.email ?? null
  const currentUserEmail = session?.user?.email ?? null
  // Photo path for the logged-in user, looked up by email so it works regardless of name variant
  const currentUserPhotoPath = currentUserEmail
    ? (users.find((u) => u.email === currentUserEmail)?.photoPath ?? null)
    : null

  return (
    <DashboardClient
      allCenarios={cenarios}
      allModulos={modulos}
      allUsers={users}
      currentUser={currentUser}
      currentUserPhotoPath={currentUserPhotoPath}
    />
  )
}
