import { notFound } from "next/navigation"
import { getCenario, getCenarios } from "@/lib/actions/cenarios"
import { getSuiteById } from "@/lib/actions/suites"
import CenarioDetailClient from "./CenarioDetailClient"

export default async function CenarioDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ suiteId?: string }>
}) {
  const { id } = await params
  const { suiteId } = await searchParams

  const [cenario, allCenarios, suite] = await Promise.all([
    getCenario(id),
    getCenarios(),
    suiteId ? getSuiteById(suiteId) : Promise.resolve(null),
  ])

  if (!cenario) notFound()

  return (
    <CenarioDetailClient
      cenario={cenario}
      suite={suite ?? undefined}
      allCenarios={allCenarios}
    />
  )
}
