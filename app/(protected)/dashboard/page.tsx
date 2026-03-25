import { getModulos } from "@/lib/actions/modulos"
import { getCenarios } from "@/lib/actions/cenarios"
import { DashboardClient } from "./DashboardClient"

export default async function DashboardPage() {
  const [modulos, cenarios] = await Promise.all([getModulos(), getCenarios()])
  return (
    <DashboardClient
      allCenarios={cenarios}
      allModulos={modulos}
    />
  )
}
