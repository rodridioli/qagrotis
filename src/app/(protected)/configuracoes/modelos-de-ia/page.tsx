export const dynamic = "force-dynamic"
export const metadata = { title: "Modelos de IA" }

import { getIntegracoes } from "@/features/integracoes/actions/integracoes"
import { checkIsAdmin } from "@/core/session"
import IntegracoesClient from "./IntegracoesClient"

export default async function IntegracoesPage() {
  const [integracoes, isAdmin] = await Promise.all([getIntegracoes(), checkIsAdmin()])
  return <IntegracoesClient initialIntegracoes={integracoes} isAdmin={isAdmin} />
}
