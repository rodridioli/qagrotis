export const dynamic = "force-dynamic"
export const metadata = { title: "Execução" }

import { notFound } from "next/navigation"
import { getCenario, getCenarios } from "@/features/qa/actions/cenarios"
import { getSuiteById } from "@/features/qa/actions/suites"
import CenarioDetailClient from "@/app/(protected)/cenarios/[id]/CenarioDetailClient"

export default async function SuiteCenarioDetailPage({
  params,
}: {
  params: Promise<{ id: string; cenarioId: string }>
}) {
  const { id: suiteId, cenarioId } = await params

  const [cenario, allCenarios, suite] = await Promise.all([
    getCenario(cenarioId),
    getCenarios(),
    getSuiteById(suiteId),
  ])

  if (!cenario || !suite) notFound()

  return (
    <CenarioDetailClient
      cenario={cenario}
      suite={suite}
      allCenarios={allCenarios}
    />
  )
}
