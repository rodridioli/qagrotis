export const dynamic = "force-dynamic"

import { notFound } from "next/navigation"
import { getCenario, getCenarios } from "@/lib/actions/cenarios"
import { getSuiteById, getSuites } from "@/lib/actions/suites"
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

  const [cenario, allCenarios] = await Promise.all([
    getCenario(id),
    getCenarios(),
  ])

  if (!cenario) notFound()

  let suite = null
  if (suiteId) {
    suite = await getSuiteById(suiteId)
  } else {
    const allSuites = await getSuites()
    suite = allSuites.find((s) => s.cenarios.some((c) => c.id === id)) ?? null
  }

  return (
    <CenarioDetailClient
      cenario={cenario}
      suite={suite ?? undefined}
      allCenarios={allCenarios}
    />
  )
}
