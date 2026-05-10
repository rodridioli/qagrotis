export const dynamic = "force-dynamic"
export const metadata = { title: "Credenciais" }

import { redirect } from "next/navigation"
import { auth } from "@/core/auth"
import { getCredenciais } from "@/features/qa/actions/credenciais"
import { CredenciaisClient } from "./CredenciaisClient"

export default async function CredenciaisPage() {
  const session = await auth()
  if (session?.user?.type !== "Administrador") redirect("/forbidden")
  const credenciais = await getCredenciais()
  return <CredenciaisClient initialCredenciais={credenciais} />
}
