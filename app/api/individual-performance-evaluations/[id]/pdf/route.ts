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

  // Resolve photo as data URL (data:image/...;base64,...)
  let evaluatedPhotoDataUrl: string | null = null
  const photoPath = profile?.photoPath?.trim()
  if (photoPath?.startsWith("data:image/")) {
    evaluatedPhotoDataUrl = photoPath
  } else if (photoPath && (photoPath.startsWith("http://") || photoPath.startsWith("https://"))) {
    try {
      const r = await fetch(photoPath)
      if (r.ok) {
        const buf2 = Buffer.from(await r.arrayBuffer())
        const ct = r.headers.get("content-type") ?? "image/jpeg"
        evaluatedPhotoDataUrl = `data:${ct};base64,${buf2.toString("base64")}`
      }
    } catch {
      evaluatedPhotoDataUrl = null
    }
  }

  const buf = buildIndividualEvaluationPdfBuffer(ev, {
    evaluatedName: profile?.name?.trim() || "—",
    evaluatedEmail: profile?.email?.trim() ?? null,
    evaluatorName,
    evaluatedPhotoDataUrl,
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
