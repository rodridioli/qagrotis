import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { buildRole, can } from "@/lib/rbac/policy"
import { getIndividualPerformanceEvaluation } from "@/lib/actions/individual-performance-evaluations"
import { getQaUserProfile } from "@/lib/actions/usuarios"
import { evaluationDisplayCodigo } from "@/lib/individual-performance-evaluation"
import { buildIndividualEvaluationPdfBuffer } from "@/lib/pdf/individual-evaluation-report"

export const runtime = "nodejs"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return new NextResponse(null, { status: 401 })
  }

  const role = buildRole(session.user.type, session.user.accessProfile)
  if (!can(role, "individual.viewOthers")) {
    return new NextResponse(null, { status: 403 })
  }

  if (session.user.type !== "Administrador" || session.user.accessProfile !== "MGR") {
    return new NextResponse(null, { status: 403 })
  }

  const { id } = await params
  if (!id || id.length > 128) {
    return new NextResponse(null, { status: 400 })
  }

  const ev = await getIndividualPerformanceEvaluation(id)
  if (!ev) {
    return new NextResponse(null, { status: 404 })
  }

  const profile = await getQaUserProfile(ev.evaluatedUserId)
  const evaluatorName =
    (typeof session.user.name === "string" && session.user.name.trim()) ||
    (typeof session.user.email === "string" && session.user.email) ||
    "—"

  const buf = buildIndividualEvaluationPdfBuffer(ev, {
    evaluatedName: profile?.name?.trim() || "—",
    evaluatedEmail: profile?.email?.trim() ?? null,
    evaluatorName,
  })

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="avaliacao-${evaluationDisplayCodigo(ev.codigo)}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  })
}
