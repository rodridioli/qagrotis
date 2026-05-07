export const dynamic = "force-dynamic"

import { redirect, notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { buildRole, can } from "@/lib/rbac/policy"
import { getActiveQaUsers } from "@/actions/usuarios"
import { getIndividualFeedback } from "@/actions/individual-feedbacks"
import { feedbackDisplayCodigo } from "@/lib/individual-feedback"
import { IndividualFeedbackPageClient } from "@/components/individual/IndividualFeedbackPageClient"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ feedbackId: string }>
}) {
  const { feedbackId } = await params
  return { title: feedbackDisplayCodigo(Number(feedbackId.replace(/\D/g, "") || "0")) }
}

export default async function IndividualFeedbackDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ feedbackId: string }>
  searchParams: Promise<{ userId?: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const role = buildRole(session.user.type, session.user.accessProfile)
  if (!can(role, "menu.individual")) redirect("/dashboard")
  if (!can(role, "individual.viewOthers")) redirect("/dashboard")

  const { feedbackId } = await params
  const { userId } = await searchParams
  if (!userId?.trim()) redirect("/individual/ficha")

  const [activeUsers, detail] = await Promise.all([
    getActiveQaUsers(),
    getIndividualFeedback(feedbackId),
  ])

  if (!detail) notFound()

  const u = activeUsers.find((x) => x.id === userId)
  if (!u) redirect(`/individual/feedbacks?userId=${encodeURIComponent(userId ?? "")}`)

  return (
    <IndividualFeedbackPageClient
      evaluatedUserId={userId!}
      evaluatedUser={{ name: u.name, photoPath: u.photoPath, email: u.email }}
      initialDetail={detail}
    />
  )
}
