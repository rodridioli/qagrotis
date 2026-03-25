import { getModulos } from "@/lib/actions/modulos"
import { getSistemas } from "@/lib/actions/sistemas"
import { getClientes } from "@/lib/actions/clientes"
import NovoCenarioClient from "./NovoCenarioClient"

export default async function NovoCenarioPage() {
  const [modulos, sistemas, clientes] = await Promise.all([
    getModulos(),
    getSistemas(),
    getClientes(),
  ])
  return (
    <NovoCenarioClient
      initialModulos={modulos.filter((m) => m.active)}
      allSistemas={sistemas.filter((s) => s.active)}
      initialClientes={clientes.filter((c) => c.active)}
    />
  )
}
