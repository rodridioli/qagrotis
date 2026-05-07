export const dynamic = "force-dynamic"
export const metadata = { title: "Credenciais" }

import { getCredenciais } from "@/features/qa/actions/credenciais"
import { CredenciaisClient } from "./CredenciaisClient"

export default async function CredenciaisPage() {
  const credenciais = await getCredenciais()
  return <CredenciaisClient initialCredenciais={credenciais} />
}
