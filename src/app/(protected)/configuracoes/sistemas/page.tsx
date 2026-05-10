export const dynamic = "force-dynamic"
export const metadata = { title: "Sistemas" }

import { redirect } from "next/navigation"
import { auth } from "@/core/auth"
import { getSistemas } from "@/features/qa/actions/sistemas"
import { getModulos } from "@/features/qa/actions/modulos"
import { checkIsAdmin } from "@/core/session"
import SistemasClient from "./SistemasClient"

export default async function SistemasPage() {
  const session = await auth()
  if (session?.user?.type !== "Administrador") redirect("/forbidden")
  const [sistemas, modulos, isAdmin] = await Promise.all([getSistemas(), getModulos(), checkIsAdmin()])
  return <SistemasClient initialSistemas={sistemas} initialModulos={modulos} isAdmin={isAdmin} />
}
