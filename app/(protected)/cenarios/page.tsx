import { getCenarios } from "@/lib/actions/cenarios"
import { getModulos } from "@/lib/actions/modulos"
import { getClientes } from "@/lib/actions/clientes"
import CenariosClient from "./CenariosClient"

export default async function CenariosPage() {
  const [cenarios, modulos, clientes] = await Promise.all([getCenarios(), getModulos(), getClientes()])
  return (
    <CenariosClient
      initialCenarios={cenarios}
      allModulos={modulos.filter((m) => m.active)}
      initialClientes={clientes.filter((c) => c.active)}
    />
  )
}
