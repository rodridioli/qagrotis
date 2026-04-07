import { getChangelog } from "@/lib/actions/changelog"
import { AtualizacoesClient } from "./AtualizacoesClient"

export default async function AtualizacoesPage() {
  const entries = await getChangelog()
  return <AtualizacoesClient entries={entries} />
}
