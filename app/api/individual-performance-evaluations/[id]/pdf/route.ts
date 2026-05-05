import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { buildRole, can } from "@/lib/rbac/policy"
import {
  getIndividualPerformanceEvaluation,
  getMyCompletedEvaluation,
} from "@/lib/actions/individual-performance-evaluations"
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

  const { id } = await params
  if (!id || id.length > 128) {
    return new NextResponse(null, { status: 400 })
  }

  const role = buildRole(session.user.type, session.user.accessProfile)
  const isMgr = can(role, "individual.viewOthers") &&
    session.user.type === "Administrador" &&
    session.user.accessProfile === "MGR"

  // MGR usa getIndividualPerformanceEvaluation; o próprio avaliado usa getMyCompletedEvaluation.
  let ev
  if (isMgr) {
    ev = await getIndividualPerformanceEvaluation(id)
  } else {
    ev = await getMyCompletedEvaluation(id)
  }

  if (!ev) {
    return new NextResponse(null, { status: 404 })
  }

  const profile = await getQaUserProfile(ev.evaluatedUserId)
  const evaluatorName =
    (typeof session.user.name === "string" && session.user.name.trim()) ||
    (typeof session.user.email === "string" && session.user.email) ||
    "—"

  // Resolve photo as data URL (data:image/...;base64,...)
  // External URLs: enforce 2 s timeout + 5 MB max to prevent DoS via malicious image URLs.
  const PHOTO_MAX_BYTES = 5 * 1024 * 1024
  let evaluatedPhotoDataUrl: string | null = null
  const photoPath = profile?.photoPath?.trim()
  if (photoPath?.startsWith("data:image/")) {
    evaluatedPhotoDataUrl = photoPath
  } else if (photoPath && (photoPath.startsWith("http://") || photoPath.startsWith("https://"))) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 2_000)
      const r = await fetch(photoPath, {
        signal: controller.signal,
        headers: { Accept: "image/jpeg,image/png,image/webp,image/gif" },
      })
      clearTimeout(timeoutId)
      if (r.ok) {
        const contentLength = Number(r.headers.get("content-length") ?? "0")
        if (contentLength > PHOTO_MAX_BYTES) {
          // Photo too large — skip silently
        } else {
          const buf2 = Buffer.from(await r.arrayBuffer())
          if (buf2.length <= PHOTO_MAX_BYTES) {
            const ct = r.headers.get("content-type") ?? "image/jpeg"
            // Only accept image content types
            if (/^image\/(jpeg|png|webp|gif)/i.test(ct)) {
              evaluatedPhotoDataUrl = `data:${ct};base64,${buf2.toString("base64")}`
            }
          }
        }
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
