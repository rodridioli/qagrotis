import { MOCK_SUITES } from "@/lib/qagrotis-constants"
import { SuiteForm } from "@/components/qagrotis/SuiteForm"

export default function SuiteDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const suite = MOCK_SUITES.find((s) => s.id === params.id)

  return <SuiteForm mode="edit" suite={suite} />
}
