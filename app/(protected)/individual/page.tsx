export const dynamic = "force-dynamic"
export const metadata = { title: "Individual" }

import Link from "next/link"
import { redirect } from "next/navigation"
import { Target, ClipboardCheck, MessageSquare, Award, TrendingUp } from "lucide-react"
import { auth } from "@/lib/auth"
import { buildRole, can } from "@/lib/rbac/policy"
import { getActiveQaUsers } from "@/lib/actions/usuarios"

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

  if (!canViewOthers && requestedUserId) {
    redirect("/individual")
  }

  const activeUsers = canViewOthers
    ? (await getActiveQaUsers()).slice().sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
    : []

  let querySuffix = ""
  if (canViewOthers && activeUsers.length > 0) {
    const ids = new Set(activeUsers.map((u) => u.id))
    if (!requestedUserId || !ids.has(requestedUserId)) {
      redirect(`/individual?userId=${encodeURIComponent(activeUsers[0].id)}`)
    }
    querySuffix = `?userId=${encodeURIComponent(requestedUserId)}`
  } else if (canViewOthers && requestedUserId) {
    redirect("/individual")
  }

  return (
    <div className="flex flex-col gap-6">
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
