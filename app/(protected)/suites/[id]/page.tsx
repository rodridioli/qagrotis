import { MOCK_SUITES } from "@/lib/qagrotis-constants"
import { getActiveSistemaNames } from "@/lib/actions/sistemas"
import { SuiteForm } from "@/components/qagrotis/SuiteForm"

export default async function SuiteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [suite, systemList] = await Promise.all([
    Promise.resolve(MOCK_SUITES.find((s) => s.id === id)),
    getActiveSistemaNames(),
  ])

  return <SuiteForm mode="edit" suite={suite} systemList={systemList} />
}
