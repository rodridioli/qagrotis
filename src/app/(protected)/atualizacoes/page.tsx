export const dynamic = "force-dynamic"
export const metadata = { title: "Atualizações" }

import { getChangelog } from "@/actions/changelog"
import { AtualizacoesClient } from "./AtualizacoesClient"

export default async function AtualizacoesPage() {
  const entries = await getChangelog()
  return <AtualizacoesClient entries={entries} />
}
