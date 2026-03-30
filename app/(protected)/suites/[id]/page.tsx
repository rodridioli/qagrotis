import { notFound } from "next/navigation"
import { getSuiteById } from "@/lib/actions/suites"
import { getActiveSistemaNames } from "@/lib/actions/sistemas"
import { getModulos } from "@/lib/actions/modulos"
import { getCenarios } from "@/lib/actions/cenarios"
import { SuiteForm } from "@/components/qagrotis/SuiteForm"

export default async function SuiteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [suite, systemList, allModulos, allCenarios] = await Promise.all([
    getSuiteById(id),
    getActiveSistemaNames(),
    getModulos(),
    getCenarios(),
  ])

  if (!suite) notFound()

  const activeModulos = allModulos.filter((m) => m.active)
  const activeCenarios = allCenarios.filter((c) => c.active)

  return (
    <SuiteForm
      mode="edit"
      suite={suite}
      systemList={systemList}
      allModulos={activeModulos}
      allCenarios={activeCenarios}
    />
  )
}
