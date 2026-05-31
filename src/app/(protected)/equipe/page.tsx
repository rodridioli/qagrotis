export const dynamic = "force-dynamic"
export const metadata = { title: "Equipe" }

import { redirect } from "next/navigation"
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

  try {
    await ensureEquipeChapterTables()
  } catch {
    /* DDL opcional; actions de chapters repetem a garantia */
  }

  const [isAdmin, session] = await Promise.all([checkIsAdmin(), auth()])
  const role = buildRole(session?.user?.type, session?.user?.accessProfile)
  const userAccessProfile = (session?.user?.accessProfile ?? "QA") as AccessProfile
  const currentUserId = session?.user?.id ?? ""
  const isMgr = isAdmin && userAccessProfile === "MGR"
  const canFilterByProfile = isMgr
  const canAccessEquipeLancamentos = can(role, "equipe.lancamentos")
  const canAccessEquipeClockwork = can(role, "equipe.clockwork")
  const canViewOthersClockwork = isMgr

  // Protege acesso direto via URL para roles sem permissão
  if (tab === "lancamentos" && !canAccessEquipeLancamentos) {
    redirect("/equipe?tab=chapters")
  }
  if (tab === "clockwork" && !canAccessEquipeClockwork) {
    redirect("/equipe?tab=chapters")
  }

  const defaultTab: EquipeTabId = "chapters"
  const initialTab: EquipeTabId =
    tab && (EQUIPE_TAB_IDS as readonly string[]).includes(tab) ? (tab as EquipeTabId) : defaultTab

  return (
    <EquipeClient
      isAdmin={serializeRscProps(isAdmin)}
      userAccessProfile={serializeRscProps(userAccessProfile)}
      canFilterByProfile={serializeRscProps(canFilterByProfile)}
      canAccessEquipeLancamentos={serializeRscProps(canAccessEquipeLancamentos)}
      canAccessEquipeClockwork={serializeRscProps(canAccessEquipeClockwork)}
      canViewOthersClockwork={serializeRscProps(canViewOthersClockwork)}
      currentUserId={serializeRscProps(currentUserId)}
      isMgr={serializeRscProps(isMgr)}
      initialTab={initialTab}
    />
  )
}
