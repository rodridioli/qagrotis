import { getActiveSistemaNames } from "@/lib/actions/sistemas"
import { SuiteForm } from "@/components/qagrotis/SuiteForm"

export default async function NovaSuitePage() {
  const systemList = await getActiveSistemaNames()
  return <SuiteForm mode="create" systemList={systemList} />
}
