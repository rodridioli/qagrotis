import { notFound } from "next/navigation"
import { getCenario } from "@/lib/actions/cenarios"
import { getModulos } from "@/lib/actions/modulos"
import { getSistemas } from "@/lib/actions/sistemas"
import { getClientes } from "@/lib/actions/clientes"
import EditarCenarioClient from "./EditarCenarioClient"

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditarCenarioPage({ params }: Props) {
  const { id } = await params
  const [cenario, modulos, sistemas, clientes] = await Promise.all([
    getCenario(id),
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
