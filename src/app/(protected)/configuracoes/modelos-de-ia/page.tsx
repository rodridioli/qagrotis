export const dynamic = "force-dynamic"
export const metadata = { title: "Modelos de IA" }

import { getIntegracoes } from "@/features/integracoes/actions/integracoes"
import { checkIsAdmin, checkCanHardDelete } from "@/core/session"
import IntegracoesClient from "./IntegracoesClient"

export default async function IntegracoesPage() {
  const [integracoes, isAdmin, canHardDelete] = await Promise.all([getIntegracoes(), checkIsAdmin(), checkCanHardDelete()])
  return <IntegracoesClient initialIntegracoes={integracoes} isAdmin={isAdmin} canHardDelete={canHardDelete} />
}
