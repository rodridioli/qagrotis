export const dynamic = "force-dynamic"
export const metadata = { title: "Equipe" }

import { getSistemasEModulos } from "@/features/equipe/actions/equipe"
import { ensureEquipeChapterTables } from "@/core/prisma-schema-ensure"
import { serializeRscProps } from "@/core/rsc-serialize"
import { checkIsAdmin } from "@/core/session"
import { auth } from "@/core/auth"
import { buildRole, can, type AccessProfile } from "@/core/rbac/policy"
import { EQUIPE_TAB_IDS, type EquipeTabId } from "@/features/equipe/components/equipeNavEntries"
import EquipeClient from "./EquipeClient"

export default async function EquipePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams
  const initialTab: EquipeTabId =
    tab && (EQUIPE_TAB_IDS as readonly string[]).includes(tab) ? (tab as EquipeTabId) : "performance"
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
      initialTab={initialTab}
    />
  )
}
