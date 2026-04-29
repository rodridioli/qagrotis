export const dynamic = "force-dynamic"
export const metadata = { title: "Individual" }

import Link from "next/link"
import { redirect } from "next/navigation"
import { Target, ClipboardCheck, MessageSquare, Award, TrendingUp } from "lucide-react"
import { auth } from "@/lib/auth"
import { buildRole, can } from "@/lib/rbac/policy"
import { getQaUsers } from "@/lib/actions/usuarios"
import IndividualUserSelector from "./IndividualUserSelector"

interface SectionCard {
  href: string
  icon: typeof Target
  label: string
}

const SECTIONS: SectionCard[] = [
  { href: "dominio",    icon: Target,         label: "Domínio" },
  { href: "avaliacoes", icon: ClipboardCheck, label: "Avaliações" },
  { href: "feedbacks",  icon: MessageSquare,  label: "Feedbacks" },
  { href: "conquistas", icon: Award,          label: "Conquistas" },
  { href: "pdi",        icon: TrendingUp,     label: "PDI" },
]

export default async function IndividualPage({
  searchParams,
}: {
  searchParams: Promise<{ userId?: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const role = buildRole(session.user.type, session.user.accessProfile)
  if (!can(role, "menu.individual")) redirect("/dashboard")

  const canViewOthers = can(role, "individual.viewOthers")
  const { userId: requestedUserId } = await searchParams

  let targetUserId = session.user.id
  if (requestedUserId && requestedUserId !== session.user.id) {
    if (!canViewOthers) redirect("/individual")
    targetUserId = requestedUserId
  }

  const users = canViewOthers ? await getQaUsers() : []
  const isViewingOther = targetUserId !== session.user.id
  const querySuffix = isViewingOther ? `?userId=${encodeURIComponent(targetUserId)}` : ""

  return (
    <div className="flex flex-col gap-6">
      {canViewOthers && users.length > 0 && (
        <IndividualUserSelector
          users={users.map((u) => ({ id: u.id, name: u.name }))}
          selectedUserId={targetUserId}
          selfId={session.user.id}
        />
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {SECTIONS.map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={`/individual/${href}${querySuffix}`}
            className="flex flex-col items-center gap-3 rounded-xl bg-surface-card p-8 shadow-card transition-colors hover:bg-neutral-grey-50"
          >
            <div className="flex size-12 items-center justify-center rounded-full bg-primary-100 text-brand-primary">
              <Icon className="size-6" />
            </div>
            <span className="font-semibold text-text-primary">{label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
