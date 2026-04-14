export const dynamic = "force-dynamic"

import { Suspense } from "react"
import { notFound } from "next/navigation"
import { getSuiteById } from "@/lib/actions/suites"
import { getActiveSistemaNames } from "@/lib/actions/sistemas"
import { getModulos } from "@/lib/actions/modulos"
import { getCenarios } from "@/lib/actions/cenarios"
import { SuiteForm } from "@/components/qagrotis/SuiteForm"

async function SuiteDetailContent({ id }: { id: string }) {
  const [suite, systemList, allModulos, allCenarios] = await Promise.all([
    getSuiteById(id),
    getActiveSistemaNames(),
    getModulos(),
    getCenarios(),
  ])

  if (!suite) notFound()

  const activeModulos = allModulos.filter((m) => m.active)

  return (
    <SuiteForm
      mode="edit"
      suite={suite}
      systemList={systemList}
      initialSistema={suite.sistema || systemList[0] || ""}
      allModulos={activeModulos}
      allCenarios={allCenarios}
    />
  )
}

export default async function SuiteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return (
    <Suspense>
      <SuiteDetailContent id={id} />
    </Suspense>
  )
}
