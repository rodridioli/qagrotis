import { getSistemas } from "@/lib/actions/sistemas"
import { getModulos } from "@/lib/actions/modulos"
import { checkIsAdmin } from "@/lib/session"
import SistemasClient from "./SistemasClient"

export default async function SistemasPage() {
  const [sistemas, modulos, isAdmin] = await Promise.all([getSistemas(), getModulos(), checkIsAdmin()])
  return <SistemasClient initialSistemas={sistemas} initialModulos={modulos} isAdmin={isAdmin} />
}
