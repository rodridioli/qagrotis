import { notFound } from "next/navigation"
import { getCenario } from "@/lib/actions/cenarios"
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

  const cenario = await getCenario(id)
  if (!cenario) notFound()

  const suite = suiteId ? await getSuiteById(suiteId) : null

  return <CenarioDetailClient cenario={cenario} suite={suite ?? undefined} />
}
