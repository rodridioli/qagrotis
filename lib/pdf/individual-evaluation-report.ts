/**
 * Relatório PDF da avaliação de desempenho (visualização, estilo leve e cantos arredondados).
 * Usa jsPDF + jspdf-autotable — sem dependências extra de rasterização de SVG.
 */

import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import type { IndividualPerformanceEvaluationDetail } from "@/lib/actions/individual-performance-evaluations"
import {
  computePerformanceScorePercent,
  EVALUATION_LEVEL_LABELS,
  evaluationDisplayCodigo,
  evaluationPeriodLabel,
  PERFORMANCE_EVALUATION_SECTIONS,
  performanceScoreQualitativeLabel,
} from "@/lib/individual-performance-evaluation"

export interface IndividualEvaluationPdfMeta {
  evaluatedName: string
  evaluatedEmail: string | null
  evaluatorName: string
}

type DocWithTable = jsPDF & { lastAutoTable?: { finalY: number } }

const PAGE = { l: 14, r: 14, t: 12, b: 16 }
const C = {
  pageBg: [244, 245, 249] as [number, number, number],
  card: [255, 255, 255] as [number, number, number],
  border: [229, 231, 235] as [number, number, number],
  shadow: [220, 223, 230] as [number, number, number],
  brand: [0, 115, 93] as [number, number, number],
  brandSoft: [237, 250, 246] as [number, number, number],
  text: [26, 32, 44] as [number, number, number],
  muted: [107, 114, 128] as [number, number, number],
}

/** Pastéis por coluna de nível (alinhado à UI). */
const LEVEL_HEAD_FILL: [number, number, number][] = [
  [255, 241, 242],
  [255, 247, 237],
  [254, 252, 232],
  [240, 249, 255],
  [236, 253, 245],
]

function formatDataYmdPt(ymd: string): string {
  const [y, m, d] = ymd.split("-")
  if (!y || !m || !d) return ymd
  return `${d}/${m}/${y}`
}

function drawSoftCard(doc: jsPDF, x: number, y: number, w: number, h: number, r: number): void {
  doc.setFillColor(...C.shadow)
  doc.roundedRect(x + 0.5, y + 0.5, w, h, r, r, "F")
  doc.setFillColor(...C.card)
  doc.setDrawColor(...C.border)
  doc.setLineWidth(0.25)
  doc.roundedRect(x, y, w, h, r, r, "FD")
}

function drawFooter(doc: jsPDF, pageW: number, pageH: number, pageIndex: number, totalPages: number): void {
  doc.setFontSize(7.5)
  doc.setTextColor(156, 163, 175)
  doc.setFont("helvetica", "normal")
  const now = new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
  doc.text(`QAgrotis · Gerado em ${now} · ${pageIndex}/${totalPages}`, pageW / 2, pageH - PAGE.b + 4, {
    align: "center",
  })
}

function ensureSpace(doc: jsPDF, y: number, need: number, pageW: number, pageH: number): number {
  if (y + need > pageH - PAGE.b - 10) {
    doc.addPage()
    doc.setFillColor(...C.pageBg)
    doc.rect(0, 0, pageW, pageH, "F")
    return PAGE.t
  }
  return y
}

/**
 * Gera o PDF em memória (Node / route handler).
 */
export function buildIndividualEvaluationPdfBuffer(
  ev: IndividualPerformanceEvaluationDetail,
  meta: IndividualEvaluationPdfMeta,
): Buffer {
  const doc = new jsPDF({ unit: "mm", format: "a4" })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()

  doc.setFillColor(...C.pageBg)
  doc.rect(0, 0, pageW, pageH, "F")

  let y = PAGE.t
  const innerW = pageW - PAGE.l - PAGE.r

  // ── Cabeçalho (cartão com sombra suave) ─────────────────────────────
  const headerH = 46
  drawSoftCard(doc, PAGE.l, y, innerW, headerH, 4)
  const hx = PAGE.l + 6
  let hy = y + 10

  // “Logo” QAgrotis — cápsula arredondada (mesma identidade que public/logo-qa-light.svg)
  const logoW = 44
  const logoH = 12
  doc.setFillColor(...C.brand)
  doc.roundedRect(hx, hy, logoW, logoH, 2.5, 2.5, "F")
  doc.setTextColor(255, 255, 255)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(11)
  doc.text("QAgrotis", hx + logoW / 2, hy + logoH / 2 + 3.2, { align: "center" })

  doc.setTextColor(...C.text)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(17)
  doc.text("Avaliação de desempenho", hx + logoW + 8, hy + 4)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.setTextColor(...C.muted)
  doc.text("Relatório de visualização", hx + logoW + 8, hy + 10)

  y += headerH + 10

  // ── Resumo (cartão) ─────────────────────────────────────────────────
  const score = computePerformanceScorePercent(ev.selections)
  const scorePct = score ?? ev.pontuacaoPercent
  const scoreLabel = performanceScoreQualitativeLabel(scorePct ?? null)

  const summaryH = 46
  y = ensureSpace(doc, y, summaryH + 6, pageW, pageH)
  drawSoftCard(doc, PAGE.l, y, innerW, summaryH, 3)

  const colW = innerW / 3 - 4
  const sx = PAGE.l + 5
  const sy = y + 7
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.setTextColor(...C.muted)
  doc.text("Código", sx, sy)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(11)
  doc.setTextColor(...C.text)
  doc.text(evaluationDisplayCodigo(ev.codigo), sx, sy + 6)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.setTextColor(...C.muted)
  doc.text("Situação", sx + colW + 4, sy)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(11)
  doc.setTextColor(...C.text)
  doc.text(ev.status === "CONCLUIDA" ? "Concluída" : "Rascunho", sx + colW + 4, sy + 6)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.setTextColor(...C.muted)
  doc.text("Pontuação", sx + (colW + 4) * 2, sy)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(11)
  doc.setTextColor(...C.brand)
  doc.text(scorePct != null ? `${scorePct.toFixed(0).replace(".", ",")}%` : "—", sx + (colW + 4) * 2, sy + 6)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(7.5)
  doc.setTextColor(...C.muted)
  doc.text(scoreLabel, sx + (colW + 4) * 2, sy + 11)

  const sy2 = y + 20
  doc.setFontSize(8)
  doc.setTextColor(...C.muted)
  doc.text("Avaliado", sx, sy2)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(10)
  doc.setTextColor(...C.text)
  doc.text(meta.evaluatedName, sx, sy2 + 4.5)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(7.5)
  doc.setTextColor(...C.muted)
  if (meta.evaluatedEmail) {
    const emailLines = doc.splitTextToSize(meta.evaluatedEmail, colW + 8)
    doc.text(emailLines, sx, sy2 + 9)
  }

  doc.setFontSize(8)
  doc.setTextColor(...C.muted)
  doc.text("Período", sx + colW + 4, sy2)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(10)
  doc.setTextColor(...C.text)
  doc.text(evaluationPeriodLabel(ev.periodo), sx + colW + 4, sy2 + 4.5)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.setTextColor(...C.muted)
  doc.text("Data da avaliação", sx + (colW + 4) * 2, sy2)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(10)
  doc.setTextColor(...C.text)
  doc.text(formatDataYmdPt(ev.dataYmd), sx + (colW + 4) * 2, sy2 + 4.5)

  const sy3 = y + 36
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.setTextColor(...C.muted)
  doc.text("Avaliador", sx, sy3)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(9.5)
  doc.setTextColor(...C.text)
  const evLines = doc.splitTextToSize(meta.evaluatorName, innerW - 10)
  doc.text(evLines, sx, sy3 + 4.5)

  y += summaryH + 10

  // ── Secções + tabelas ───────────────────────────────────────────────
  const headRow = ["Competência", ...([...EVALUATION_LEVEL_LABELS] as string[])]

  for (const section of PERFORMANCE_EVALUATION_SECTIONS) {
    const body = section.competencies.map((c) => {
      const lvl = ev.selections[c.id]
      const marks = [...EVALUATION_LEVEL_LABELS].map((_, i) => (lvl === i ? "\u2713" : "—"))
      return [c.label, ...marks]
    })

    y = ensureSpace(doc, y, 28, pageW, pageH)

    doc.setFillColor(...C.brandSoft)
    doc.setDrawColor(...C.border)
    doc.setLineWidth(0.2)
    doc.roundedRect(PAGE.l, y, innerW, 9, 2, 2, "FD")
    doc.setTextColor(...C.brand)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(10.5)
    doc.text(section.label, PAGE.l + 4, y + 6.2)
    y += 11

    autoTable(doc, {
      startY: y,
      margin: { left: PAGE.l, right: PAGE.r, top: 0, bottom: 0 },
      head: [headRow],
      body,
      theme: "plain",
      styles: {
        fontSize: 7,
        cellPadding: 1.8,
        lineColor: C.border,
        lineWidth: 0.12,
        textColor: C.text,
        valign: "middle",
      },
      headStyles: {
        fillColor: [249, 250, 251],
        textColor: [55, 65, 81],
        fontStyle: "bold",
        fontSize: 7,
        halign: "center",
      },
      columnStyles: {
        0: { halign: "left", cellWidth: 46, fillColor: [249, 250, 251], fontStyle: "normal" },
        1: { halign: "center", fillColor: LEVEL_HEAD_FILL[0] },
        2: { halign: "center", fillColor: LEVEL_HEAD_FILL[1] },
        3: { halign: "center", fillColor: LEVEL_HEAD_FILL[2] },
        4: { halign: "center", fillColor: LEVEL_HEAD_FILL[3] },
        5: { halign: "center", fillColor: LEVEL_HEAD_FILL[4] },
      },
      bodyStyles: {
        fillColor: [255, 255, 255],
      },
      alternateRowStyles: {
        fillColor: [252, 252, 253],
      },
      didParseCell: (data) => {
        if (data.section === "head" && data.column.index > 0) {
          const i = data.column.index - 1
          const tone = LEVEL_HEAD_FILL[i]
          if (tone) {
            data.cell.styles.fillColor = tone
          }
        }
        if (data.section === "head" && data.column.index === 0) {
          data.cell.styles.fillColor = [249, 250, 251]
          data.cell.styles.halign = "left"
        }
        if (data.section === "body" && data.column.index > 0) {
          const i = data.column.index - 1
          const tone = LEVEL_HEAD_FILL[i]
          if (tone) {
            const blend = (n: number) => Math.min(255, Math.round(n + (255 - n) * 0.62))
            data.cell.styles.fillColor = [blend(tone[0]), blend(tone[1]), blend(tone[2])]
          }
        }
      },
      tableLineWidth: 0.15,
      tableLineColor: C.border,
      showHead: "everyPage",
    })

    const d = doc as DocWithTable
    y = (d.lastAutoTable?.finalY ?? y) + 10
  }

  // Rodapé em todas as páginas
  const total = doc.getNumberOfPages()
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    drawFooter(doc, pageW, pageH, i, total)
  }

  const out = doc.output("arraybuffer")
  return Buffer.from(new Uint8Array(out as ArrayBuffer))
}
