import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { buildRole, can } from "@/lib/rbac/policy"
import { getIndividualPerformanceEvaluation } from "@/lib/actions/individual-performance-evaluations"
import { evaluationPeriodLabel } from "@/lib/individual-performance-evaluation"
import { jsPDF } from "jspdf"

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

  const { id } = await params
  if (!id || id.length > 128) {
    return new NextResponse(null, { status: 400 })
  }

  const ev = await getIndividualPerformanceEvaluation(id)
  if (!ev) {
    return new NextResponse(null, { status: 404 })
  }

  const doc = new jsPDF()
  let y = 14
  doc.setFontSize(14)
  doc.text("Avaliação de desempenho", 14, y)
  y += 10
  doc.setFontSize(10)
  doc.text(`Código: ${ev.codigo}`, 14, y)
  y += 6
  doc.text(`Situação: ${ev.status === "CONCLUIDA" ? "Concluída" : "Rascunho"}`, 14, y)
  y += 6
  doc.text(`Período: ${evaluationPeriodLabel(ev.periodo)}`, 14, y)
  y += 6
  if (ev.pontuacaoPercent != null) {
    doc.text(`Pontuação: ${ev.pontuacaoPercent.toFixed(1).replace(".", ",")}%`, 14, y)
  }

  const out = doc.output("arraybuffer")
  const buf = Buffer.from(new Uint8Array(out as ArrayBuffer))

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="avaliacao-${ev.codigo}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  })
}
