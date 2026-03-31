import { notFound } from "next/navigation"
import { getCenario, getCenarios } from "@/lib/actions/cenarios"
import { getSuiteById } from "@/lib/actions/suites"
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
