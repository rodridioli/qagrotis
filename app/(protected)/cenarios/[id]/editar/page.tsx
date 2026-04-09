import { notFound } from "next/navigation"
import { getCenario, getCenarios } from "@/lib/actions/cenarios"
import { getModulos } from "@/lib/actions/modulos"
import { getSistemas } from "@/lib/actions/sistemas"
import { getClientes } from "@/lib/actions/clientes"
import EditarCenarioClient from "./EditarCenarioClient"

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditarCenarioPage({ params }: Props) {
  const { id } = await params
  const [cenario, modulos, sistemas, clientes, cenarios] = await Promise.all([
    getCenario(id),
    getModulos(),
    getSistemas(),
    getClientes(),
    getCenarios(),
  ])

  if (!cenario) notFound()

  return (
    <EditarCenarioClient
      cenario={cenario}
      initialModulos={modulos.filter((m) => m.active)}
      allSistemas={sistemas.filter((s) => s.active)}
      initialClientes={clientes}
      allCenarios={cenarios.filter((c) => c.active && c.id !== id)}
    />
  )
}
