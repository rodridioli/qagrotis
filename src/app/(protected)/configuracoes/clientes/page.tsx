export const dynamic = "force-dynamic"
export const metadata = { title: "Clientes" }

import { redirect } from "next/navigation"
import { auth } from "@/core/auth"
import { getClientes } from "@/features/qa/actions/clientes"
import { getCenarios } from "@/features/qa/actions/cenarios"
import { checkIsAdmin } from "@/core/session"
import ClientesClient from "./ClientesClient"

export default async function ClientesPage() {
  const session = await auth()
  if (session?.user?.type !== "Administrador") redirect("/forbidden")
  const [clientes, cenarios, isAdmin] = await Promise.all([getClientes(), getCenarios(), checkIsAdmin()])
  return <ClientesClient initialClientes={clientes} initialCenarios={cenarios} isAdmin={isAdmin} />
}
