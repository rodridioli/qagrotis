export const metadata = { title: "Editar cenário" }

import { notFound } from "next/navigation"
import { getCenario, getCenarios } from "@/lib/actions/cenarios"
import { getModulos } from "@/lib/actions/modulos"
import { getSistemas } from "@/lib/actions/sistemas"
import { getClientes } from "@/lib/actions/clientes"
import { getCredenciais } from "@/lib/actions/credenciais"
import EditarCenarioClient from "./EditarCenarioClient"

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditarCenarioPage({ params }: Props) {
  const { id } = await params
  const [cenario, modulos, sistemas, clientes, cenarios, credenciais] = await Promise.all([
    getCenario(id),
    getModulos(),
    getSistemas(),
    getClientes(),
    getCenarios(),
    getCredenciais(),
  ])

  if (!cenario) notFound()

  return (
    <EditarCenarioClient
      cenario={cenario}
      initialModulos={modulos.filter((m) => m.active)}
      allSistemas={sistemas.filter((s) => s.active)}
      initialClientes={clientes}
      allCenarios={cenarios.filter((c) => c.active && c.id !== id)}
      initialCredenciais={credenciais}
    />
  )
}
