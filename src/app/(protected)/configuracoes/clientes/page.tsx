export const dynamic = "force-dynamic"
export const metadata = { title: "Clientes" }

import { getClientes } from "@/features/qa/actions/clientes"
import { getCenarios } from "@/features/qa/actions/cenarios"
import { checkIsAdmin } from "@/core/session"
import ClientesClient from "./ClientesClient"

export default async function ClientesPage() {
  const [clientes, cenarios, isAdmin] = await Promise.all([getClientes(), getCenarios(), checkIsAdmin()])
  return <ClientesClient initialClientes={clientes} initialCenarios={cenarios} isAdmin={isAdmin} />
}
