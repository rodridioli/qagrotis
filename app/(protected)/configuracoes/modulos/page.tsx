import { getModulos } from "@/lib/actions/modulos"
import { getCenarios } from "@/lib/actions/cenarios"
import { checkIsAdmin } from "@/lib/session"
import ModulosClient from "./ModulosClient"

export default async function ModulosPage() {
  const [modulos, cenarios, isAdmin] = await Promise.all([getModulos(), getCenarios(), checkIsAdmin()])
  return <ModulosClient initialModulos={modulos} initialCenarios={cenarios} isAdmin={isAdmin} />
}
