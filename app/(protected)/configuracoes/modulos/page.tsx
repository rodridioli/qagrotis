export const dynamic = "force-dynamic"
export const metadata = { title: "Módulos" }

import { getModulos } from "@/lib/actions/modulos"
import { getCenarios } from "@/lib/actions/cenarios"
import { getSistemas } from "@/lib/actions/sistemas"
import { checkIsAdmin } from "@/lib/session"
import ModulosClient from "./ModulosClient"

export default async function ModulosPage() {
  const [modulos, cenarios, sistemas, isAdmin] = await Promise.all([
    getModulos(), getCenarios(), getSistemas(), checkIsAdmin(),
  ])
  return <ModulosClient initialModulos={modulos} initialCenarios={cenarios} initialSistemas={sistemas} isAdmin={isAdmin} />
}
