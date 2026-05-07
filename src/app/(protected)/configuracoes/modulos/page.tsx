export const dynamic = "force-dynamic"
export const metadata = { title: "Módulos" }

import { getModulos } from "@/features/qa/actions/modulos"
import { getCenarios } from "@/features/qa/actions/cenarios"
import { getSistemas } from "@/features/qa/actions/sistemas"
import { checkIsAdmin } from "@/core/session"
import ModulosClient from "./ModulosClient"

export default async function ModulosPage() {
  const [modulos, cenarios, sistemas, isAdmin] = await Promise.all([
    getModulos(), getCenarios(), getSistemas(), checkIsAdmin(),
  ])
  return <ModulosClient initialModulos={modulos} initialCenarios={cenarios} initialSistemas={sistemas} isAdmin={isAdmin} />
}
