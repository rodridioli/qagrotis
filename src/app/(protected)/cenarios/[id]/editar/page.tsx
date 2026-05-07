export const metadata = { title: "Editar cenário" }

import { notFound } from "next/navigation"
import { getCenario, getCenarios } from "@/features/qa/actions/cenarios"
import { getModulos } from "@/features/qa/actions/modulos"
import { getSistemas } from "@/features/qa/actions/sistemas"
import { getClientes } from "@/features/qa/actions/clientes"
import { getCredenciais } from "@/features/qa/actions/credenciais"
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
