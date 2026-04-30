/**
 * Geração de PDF da avaliação de desempenho (cliente).
 * Usado apenas na área Individual / MGR; depende de `jspdf` + `jspdf-autotable`.
 */

import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import type { IndividualPerformanceEvaluationDetail } from "@/lib/actions/individual-performance-evaluations"
import {
  computePerformanceScorePercent,
  EVALUATION_LEVEL_LABELS,
  evaluationPeriodLabel,
  formatIndividualEvaluationCodigo,
  PERFORMANCE_EVALUATION_SECTIONS,
} from "@/lib/individual-performance-evaluation"

/** Verde institucional próximo a `text-brand-primary` / logo QA. */
const BRAND: [number, number, number] = [26, 107, 98]
const BRAND_LIGHT: [number, number, number] = [232, 245, 243]

function formatDataPt(ymd: string): string {
  const [y, m, d] = ymd.split("-")
  if (!y || !m || !d) return ymd
  return `${d}/${m}/${y}`
}

function situationLabel(status: IndividualPerformanceEvaluationDetail["status"]): string {
  return status === "CONCLUIDA" ? "Concluída" : "Rascunho"
}

export function downloadIndividualEvaluationPdf(opts: {
  detail: IndividualPerformanceEvaluationDetail
  evaluatedName: string
  evaluatedEmail?: string | null
  /** Data associada à linha da lista (yyyy-mm-dd). */
  dataExibicaoYmd: string
}): void {
  const { detail, evaluatedName, evaluatedEmail, dataExibicaoYmd } = opts
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 14
  let y = 0

  doc.setFillColor(BRAND[0], BRAND[1], BRAND[2])
  doc.rect(0, 0, pageW, 26, "F")
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16)
  doc.setFont("helvetica", "bold")
  doc.text("Avaliação de desempenho", margin, 12)
  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  doc.text(`${formatIndividualEvaluationCodigo(detail.codigo)} · ${situationLabel(detail.status)}`, margin, 19)

  doc.setTextColor(35, 35, 35)
  y = 32
  doc.setFontSize(10)
  doc.setFont("helvetica", "bold")
  doc.text("Avaliado", margin, y)
  doc.setFont("helvetica", "normal")
  doc.text(evaluatedName || "—", margin + 28, y)
  y += 6
  doc.setFont("helvetica", "bold")
  doc.text("E-mail", margin, y)
  doc.setFont("helvetica", "normal")
  doc.text(evaluatedEmail?.trim() || "—", margin + 28, y)
  y += 6
  doc.setFont("helvetica", "bold")
  doc.text("Período", margin, y)
  doc.setFont("helvetica", "normal")
  doc.text(evaluationPeriodLabel(detail.periodo), margin + 28, y)
  y += 6
  doc.setFont("helvetica", "bold")
  doc.text("Data da avaliação", margin, y)
  doc.setFont("helvetica", "normal")
  doc.text(formatDataPt(dataExibicaoYmd), margin + 38, y)
  y += 10

  const score = computePerformanceScorePercent(detail.selections)
  if (score != null) {
    doc.setFillColor(BRAND_LIGHT[0], BRAND_LIGHT[1], BRAND_LIGHT[2])
    doc.roundedRect(margin, y - 4, pageW - 2 * margin, 14, 2, 2, "F")
    doc.setFont("helvetica", "bold")
    doc.setFontSize(11)
    doc.setTextColor(BRAND[0], BRAND[1], BRAND[2])
    doc.text("Pontuação global", margin + 3, y + 4)
    doc.setFontSize(18)
    doc.text(`${score.toFixed(1).replace(".", ",")}%`, pageW - margin - 3, y + 6, { align: "right" })
    doc.setTextColor(35, 35, 35)
    y += 18
  }

  const head = ["Competência", ...EVALUATION_LEVEL_LABELS.map((l) => l)]

  for (const section of PERFORMANCE_EVALUATION_SECTIONS) {
    if (y > 250) {
      doc.addPage()
      y = margin
    }
    doc.setFont("helvetica", "bold")
    doc.setFontSize(11)
    doc.setTextColor(BRAND[0], BRAND[1], BRAND[2])
    doc.text(section.label, margin, y)
    y += 4

    const body = section.competencies.map((c) => {
      const sel = detail.selections[c.id]
      return [
        c.label,
        ...EVALUATION_LEVEL_LABELS.map((_, col) => (sel === col ? "✓" : "")),
      ]
    })

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [head],
      body,
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 2, valign: "middle" },
      headStyles: {
        fillColor: [BRAND[0], BRAND[1], BRAND[2]],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        halign: "center",
      },
      columnStyles: {
        0: { cellWidth: 62, fontStyle: "bold", halign: "left" },
        1: { cellWidth: 22, halign: "center" },
        2: { cellWidth: 18, halign: "center" },
        3: { cellWidth: 18, halign: "center" },
        4: { cellWidth: 20, halign: "center" },
        5: { cellWidth: 22, halign: "center" },
      },
      bodyStyles: { textColor: [40, 40, 40] },
    })

    const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY
    y = (typeof finalY === "number" ? finalY : y) + 10
  }

  doc.setFontSize(8)
  doc.setTextColor(120, 120, 120)
  doc.text("QAgrotis — documento gerado automaticamente.", margin, doc.internal.pageSize.getHeight() - 8)

  const safeName = formatIndividualEvaluationCodigo(detail.codigo).replace(/[^\w-]+/g, "_")
  doc.save(`avaliacao-${safeName}.pdf`)
}
