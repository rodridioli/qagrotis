import { getModulos } from "@/lib/actions/modulos"
import { getSuites } from "@/lib/actions/suites"
import SuitesClient from "./SuitesClient"

export default async function SuitesPage() {
  const [modulos, suites] = await Promise.all([getModulos(), getSuites()])
  return (
    <SuitesClient
      allModulos={modulos.filter((m) => m.active)}
      suites={suites}
    />
  )
}
