export const dynamic = "force-dynamic"
export const metadata = { title: "Sistemas" }

import { getSistemas } from "@/features/qa/actions/sistemas"
import { getModulos } from "@/features/qa/actions/modulos"
import { checkIsAdmin, checkCanHardDelete } from "@/core/session"
import SistemasClient from "./SistemasClient"

export default async function SistemasPage() {
  const [sistemas, modulos, isAdmin, canHardDelete] = await Promise.all([getSistemas(), getModulos(), checkIsAdmin(), checkCanHardDelete()])
  return <SistemasClient initialSistemas={sistemas} initialModulos={modulos} isAdmin={isAdmin} canHardDelete={canHardDelete} />
}
