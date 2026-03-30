import { getIntegracoes } from "@/lib/actions/integracoes"
import { checkIsAdmin } from "@/lib/session"
import IntegracoesClient from "./IntegracoesClient"

export default async function IntegracoesPage() {
  const [integracoes, isAdmin] = await Promise.all([getIntegracoes(), checkIsAdmin()])
  return <IntegracoesClient initialIntegracoes={integracoes} isAdmin={isAdmin} />
}
