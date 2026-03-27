import { getModulos } from "@/lib/actions/modulos"
import SuitesClient from "./SuitesClient"

export default async function SuitesPage() {
  const modulos = await getModulos()
  return <SuitesClient allModulos={modulos.filter((m) => m.active)} />
}
