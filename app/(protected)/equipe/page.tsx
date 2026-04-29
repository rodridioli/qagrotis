export const dynamic = "force-dynamic"
export const metadata = { title: "Equipe" }

import { getSistemasEModulos } from "@/lib/actions/equipe"
import { ensureEquipeChapterTables } from "@/lib/prisma-schema-ensure"
import { serializeRscProps } from "@/lib/rsc-serialize"
import { checkIsAdmin } from "@/lib/session"
import { auth } from "@/lib/auth"
import { buildRole, can, type AccessProfile } from "@/lib/rbac/policy"
import EquipeClient from "./EquipeClient"

export default async function EquipePage() {
  try {
    await ensureEquipeChapterTables()
  } catch {
    /* DDL opcional; actions de chapters repetem a garantia */
  }

  let sistemas: string[] = []
  let modulosPorSistema: Record<string, string[]> = {}
  try {
    const data = await getSistemasEModulos()
    sistemas = data.sistemas
    modulosPorSistema = data.modulosPorSistema
  } catch {
    // DB indisponível ou erro Prisma — a página continua renderizando; filtros ficam vazios
  }
  const [isAdmin, session] = await Promise.all([checkIsAdmin(), auth()])
  const role = buildRole(session?.user?.type, session?.user?.accessProfile)
  const userAccessProfile = (session?.user?.accessProfile ?? "QA") as AccessProfile
  const canFilterByProfile = can(role, "equipe.performance.filterByProfile")
  return (
    <EquipeClient
      sistemas={serializeRscProps(sistemas)}
      modulosPorSistema={serializeRscProps(modulosPorSistema)}
      isAdmin={serializeRscProps(isAdmin)}
      userAccessProfile={serializeRscProps(userAccessProfile)}
      canFilterByProfile={serializeRscProps(canFilterByProfile)}
    />
  )
}
