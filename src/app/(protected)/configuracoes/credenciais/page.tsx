export const dynamic = "force-dynamic"
export const metadata = { title: "Credenciais" }

import { getCredenciais } from "@/features/qa/actions/credenciais"
import { checkIsAdmin } from "@/core/session"
import { CredenciaisClient } from "./CredenciaisClient"

export default async function CredenciaisPage() {
  const [credenciais, isAdmin] = await Promise.all([getCredenciais(), checkIsAdmin()])
  return <CredenciaisClient initialCredenciais={credenciais} isAdmin={isAdmin} />
}
