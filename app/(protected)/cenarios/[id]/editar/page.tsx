import { notFound } from "next/navigation"
import { getCenario } from "@/lib/actions/cenarios"
import { getModulos } from "@/lib/actions/modulos"
import { getSistemas } from "@/lib/actions/sistemas"
import { getClientes } from "@/lib/actions/clientes"
import EditarCenarioClient from "./EditarCenarioClient"

interface Props {
  params: { id: string }
}

export default async function EditarCenarioPage({ params }: Props) {
  const [cenario, modulos, sistemas, clientes] = await Promise.all([
    getCenario(params.id),
    getModulos(),
    getSistemas(),
    getClientes(),
  ])

  if (!cenario) notFound()

  return (
    <EditarCenarioClient
      cenario={cenario}
      initialModulos={modulos.filter((m) => m.active)}
      allSistemas={sistemas.filter((s) => s.active)}
      initialClientes={clientes.filter((c) => c.active)}
    />
  )
}
