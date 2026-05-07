export const dynamic = "force-dynamic"

import { notFound, redirect } from "next/navigation"
import { auth } from "@/core/auth"
import { buildRole, can } from "@/core/rbac/policy"
import { getMyCompletedFeedback } from "@/features/individual/actions/individual-feedbacks"
import { getQaUserProfile } from "@/features/usuarios/actions/usuarios"
import { feedbackDisplayCodigo } from "@/features/individual/lib/individual-feedback"
import { IndividualFeedbackPageClient } from "@/features/individual/components/IndividualFeedbackPageClient"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ feedbackId: string }>
}) {
  const { feedbackId } = await params
  const session = await auth()
  if (!session?.user) return { title: "Feedback" }
  const d = await getMyCompletedFeedback(feedbackId)
  if (!d) return { title: "Feedback" }
  return { title: `Feedback — ${feedbackDisplayCodigo(d.codigo)}` }
}

export default async function MeuFeedbackDetailPage({
  params,
}: {
  params: Promise<{ feedbackId: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const role = buildRole(session.user.type, session.user.accessProfile)
  if (!can(role, "menu.individual")) redirect("/dashboard")

  // MGR acessa via /individual/feedbacks/[id]?userId=...; esta rota é exclusiva do avaliado.
  if (can(role, "individual.viewOthers")) {
    redirect("/individual/feedbacks")
  }

  const { feedbackId } = await params
  const detail = await getMyCompletedFeedback(feedbackId)
  if (!detail) notFound()

  const profile = await getQaUserProfile(session.user.id)

  return (
    <IndividualFeedbackPageClient
      evaluatedUserId={detail.evaluatedUserId}
      evaluatedUser={{
        name: profile?.name?.trim() || session.user.name || session.user.email || "—",
        photoPath: profile?.photoPath ?? null,
        email: profile?.email ?? session.user.email ?? null,
      }}
      initialDetail={detail}
      backHref="/individual/feedbacks"
    />
  )
}
