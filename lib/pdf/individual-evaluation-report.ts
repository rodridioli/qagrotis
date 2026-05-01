/**
 * Relatório PDF da avaliação de desempenho individual.
 * Layout single-page A4: cabeçalho · linha de meta · 3 cards info · 3 seções com tabelas.
 * Usa jsPDF + jspdf-autotable — sem dependências de browser.
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

// ── Layout constants ────────────────────────────────────────────────────────
const PAGE = { l: 12, r: 12, t: 10, b: 12 }
// innerW = 210 - 12 - 12 = 186 mm

// ── Colour palette ──────────────────────────────────────────────────────────
const C = {
  pageBg:    [248, 249, 250] as [number, number, number],
  card:      [255, 255, 255] as [number, number, number],
  border:    [229, 231, 235] as [number, number, number],
  shadow:    [218, 220, 227] as [number, number, number],
  brand:     [0,   115,  93] as [number, number, number],
  brandSoft: [237, 250, 246] as [number, number, number],
  brandDark: [0,    84,  68] as [number, number, number],
  text:      [26,   32,  44] as [number, number, number],
  muted:     [107, 114, 128] as [number, number, number],
  faint:     [156, 163, 175] as [number, number, number],
  tableBg:   [249, 250, 251] as [number, number, number],
}

/** Pastéis de preenchimento por coluna de nível (Não Atende … Excelente). */
const LEVEL_FILL: [number, number, number][] = [
  [255, 241, 242], // rose-50
  [255, 247, 237], // orange-50
  [254, 252, 232], // yellow-50
  [240, 249, 255], // sky-50
  [236, 253, 245], // emerald-50
]

/** Cor de texto por coluna de nível. */
const LEVEL_TEXT_COLOR: [number, number, number][] = [
  [185,  28,  28], // red-700
  [154,  52,  18], // orange-700
  [133,  77,  14], // yellow-700 (amber)
  [  3, 105, 161], // sky-700
  [  4, 120,  87], // emerald-700
]

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatYmdPt(ymd: string): string {
  const [y, m, d] = ymd.split("-")
  if (!y || !m || !d) return ymd
  return `${d}/${m}/${y}`
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => (w[0] ?? "").toUpperCase())
    .join("")
}

function scoreRgb(pct: number | null): [number, number, number] {
  if (pct == null) return C.muted
  if (pct >= 70) return C.brand
  if (pct >= 40) return [234, 88, 12]
  return [220, 38, 38]
}

/** Cartão branco com sombra suave e borda. */
function drawCard(doc: jsPDF, x: number, y: number, w: number, h: number, r = 3): void {
  doc.setFillColor(...C.shadow)
  doc.roundedRect(x + 0.4, y + 0.4, w, h, r, r, "F")
  doc.setFillColor(...C.card)
  doc.setDrawColor(...C.border)
  doc.setLineWidth(0.2)
  doc.roundedRect(x, y, w, h, r, r, "FD")
}

/** Badge colorida (ex.: Concluída / Rascunho). */
function drawBadge(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  fill: [number, number, number],
  fg: [number, number, number],
): void {
  doc.setFont("helvetica", "bold")
  doc.setFontSize(6)
  const tw = doc.getTextWidth(text)
  const bw = tw + 6
  const bh = 4.5
  doc.setFillColor(...fill)
  doc.setDrawColor(...fill)
  doc.roundedRect(x, y, bw, bh, 1, 1, "F")
  doc.setTextColor(...fg)
  doc.text(text, x + bw / 2, y + bh / 2 + 1.1, { align: "center" })
}

// ── Entry point ─────────────────────────────────────────────────────────────

/**
 * Gera o buffer do PDF em memória (Node / route handler).
 * Todo o conteúdo é comprimido para caber numa única página A4.
 */
export function buildIndividualEvaluationPdfBuffer(
  ev: IndividualPerformanceEvaluationDetail,
  meta: IndividualEvaluationPdfMeta,
): Buffer {
  const doc = new jsPDF({ unit: "mm", format: "a4" })
  const pageW = doc.internal.pageSize.getWidth()  // 210
  const pageH = doc.internal.pageSize.getHeight() // 297
  const innerW = pageW - PAGE.l - PAGE.r          // 186

  // Fundo de página
  doc.setFillColor(...C.pageBg)
  doc.rect(0, 0, pageW, pageH, "F")

  let y = PAGE.t // 10

  // ── 1. CABEÇALHO ──────────────────────────────────────────────────────────
  const headerH = 17
  drawCard(doc, PAGE.l, y, innerW, headerH, 3)

  // Pill logo à esquerda
  const logoX = PAGE.l + 5
  const logoY = y + (headerH - 9) / 2
  doc.setFillColor(...C.brand)
  doc.roundedRect(logoX, logoY, 34, 9, 2, 2, "F")
  doc.setFont("helvetica", "bold")
  doc.setFontSize(8.5)
  doc.setTextColor(255, 255, 255)
  doc.text("QAgrotis", logoX + 17, logoY + 6.1, { align: "center" })

  // Título centrado
  doc.setFont("helvetica", "bold")
  doc.setFontSize(9.5)
  doc.setTextColor(...C.text)
  doc.text("Avaliação periódica de desempenho", pageW / 2, y + headerH / 2 - 1.2, {
    align: "center",
  })
  doc.setFont("helvetica", "normal")
  doc.setFontSize(6.8)
  doc.setTextColor(...C.muted)
  doc.text("Avaliação Individual", pageW / 2, y + headerH / 2 + 3.2, { align: "center" })

  // Código à direita
  doc.setFont("helvetica", "bold")
  doc.setFontSize(11)
  doc.setTextColor(...C.brand)
  doc.text(evaluationDisplayCodigo(ev.codigo), pageW - PAGE.r - 5, y + headerH / 2 + 1.8, {
    align: "right",
  })

  y += headerH + 2

  // ── 2. LINHA DE META ──────────────────────────────────────────────────────
  const nowStr = new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
  doc.setFont("helvetica", "normal")
  doc.setFontSize(6.8)
  doc.setTextColor(...C.muted)
  doc.text(
    `Gerado em ${nowStr}  ·  Avaliador: ${meta.evaluatorName}`,
    PAGE.l,
    y + 3.8,
  )
  y += 5 + 3 // y ≈ 35

  // ── 3. CARDS DE INFORMAÇÃO ────────────────────────────────────────────────
  const infoH = 37
  const cardGap = 3
  const cw = (innerW - cardGap * 2) / 3 // 60 mm cada

  // Card 1 — Colaborador
  const c1x = PAGE.l
  drawCard(doc, c1x, y, cw, infoH, 3)

  // Rótulo do card
  doc.setFont("helvetica", "normal")
  doc.setFontSize(6.5)
  doc.setTextColor(...C.muted)
  doc.text("Colaborador", c1x + 5, y + 5)

  // Avatar círculo
  const aR = 9          // raio
  const aCx = c1x + 5 + aR
  const aCy = y + 6 + aR + 4  // centro vertical
  doc.setFillColor(...C.brand)
  doc.circle(aCx, aCy, aR, "F")
  doc.setFont("helvetica", "bold")
  doc.setFontSize(9)
  doc.setTextColor(255, 255, 255)
  doc.text(initials(meta.evaluatedName), aCx, aCy + 3, { align: "center" })

  // Info à direita do avatar
  const infoX = c1x + 5 + aR * 2 + 5
  const infoMaxW = cw - (aR * 2 + 12)
  let infoY = y + 9

  doc.setFont("helvetica", "bold")
  doc.setFontSize(8)
  doc.setTextColor(...C.text)
  const nameLines = doc.splitTextToSize(meta.evaluatedName, infoMaxW) as string[]
  doc.text(nameLines, infoX, infoY)
  infoY += nameLines.length * 4.2

  if (meta.evaluatedEmail) {
    doc.setFont("helvetica", "normal")
    doc.setFontSize(6.2)
    doc.setTextColor(...C.muted)
    const emailLines = doc.splitTextToSize(meta.evaluatedEmail, infoMaxW) as string[]
    doc.text(emailLines, infoX, infoY)
    infoY += emailLines.length * 3.5
  }

  infoY += 2
  if (ev.status === "CONCLUIDA") {
    drawBadge(doc, "Concluída", infoX, infoY, C.brandSoft, C.brandDark)
  } else {
    drawBadge(doc, "Rascunho", infoX, infoY, [243, 244, 246], C.muted)
  }

  // Card 2 — Pontuação
  const score = computePerformanceScorePercent(ev.selections)
  const scorePct = score ?? ev.pontuacaoPercent
  const scoreLabel = performanceScoreQualitativeLabel(scorePct ?? null)
  const c2x = c1x + cw + cardGap

  drawCard(doc, c2x, y, cw, infoH, 3)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(6.5)
  doc.setTextColor(...C.muted)
  doc.text("Pontuação", c2x + 5, y + 5)

  if (scorePct != null) {
    doc.setFont("helvetica", "bold")
    doc.setFontSize(27)
    doc.setTextColor(...scoreRgb(scorePct))
    doc.text(`${scorePct.toFixed(0)}%`, c2x + cw / 2, y + 25, { align: "center" })
    doc.setFont("helvetica", "normal")
    doc.setFontSize(7)
    doc.setTextColor(...C.muted)
    doc.text(scoreLabel, c2x + cw / 2, y + 31, { align: "center" })
  } else {
    doc.setFont("helvetica", "bold")
    doc.setFontSize(27)
    doc.setTextColor(...C.muted)
    doc.text("—", c2x + cw / 2, y + 25, { align: "center" })
  }

  // Card 3 — Data e período
  const c3x = c2x + cw + cardGap

  drawCard(doc, c3x, y, cw, infoH, 3)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(6.5)
  doc.setTextColor(...C.muted)
  doc.text("Data e período", c3x + 5, y + 5)

  doc.setFont("helvetica", "bold")
  doc.setFontSize(16)
  doc.setTextColor(...C.text)
  doc.text(formatYmdPt(ev.dataYmd), c3x + cw / 2, y + 20, { align: "center" })

  doc.setFont("helvetica", "normal")
  doc.setFontSize(7.5)
  doc.setTextColor(...C.muted)
  doc.text(evaluationPeriodLabel(ev.periodo), c3x + cw / 2, y + 27, { align: "center" })

  y += infoH + 5 // y ≈ 80

  // ── 4. SEÇÕES + TABELAS ───────────────────────────────────────────────────
  const col0W = 52
  const levelColW = (innerW - col0W) / 5 // 26.8 mm
  const headRow = ["Competência", ...(EVALUATION_LEVEL_LABELS as unknown as string[])]

  for (let si = 0; si < PERFORMANCE_EVALUATION_SECTIONS.length; si++) {
    const section = PERFORMANCE_EVALUATION_SECTIONS[si]!
    const isLast = si === PERFORMANCE_EVALUATION_SECTIONS.length - 1

    // Barra de cabeçalho da seção
    doc.setFillColor(...C.brandSoft)
    doc.setDrawColor(...C.border)
    doc.setLineWidth(0.15)
    doc.roundedRect(PAGE.l, y, innerW, 7, 2, 2, "FD")
    doc.setFont("helvetica", "bold")
    doc.setFontSize(8.5)
    doc.setTextColor(...C.brandDark)
    doc.text(section.label, PAGE.l + 5, y + 4.9)
    y += 7 + 1

    // Linhas da tabela (corpo)
    const body: string[][] = section.competencies.map((c) => {
      const lvl = ev.selections[c.id]
      const marks = EVALUATION_LEVEL_LABELS.map((_, i) => (lvl === i ? "✓" : ""))
      return [c.label, ...marks]
    })

    // Linha de rodapé: % por coluna de nível
    const total = section.competencies.length
    const levelCounts = ([0, 1, 2, 3, 4] as const).map(
      (lvl) => section.competencies.filter((c) => ev.selections[c.id] === lvl).length,
    )
    const footerRow = [
      "Pontuação (%)",
      ...levelCounts.map((cnt) => `${Math.round((cnt / total) * 100)}%`),
    ]

    autoTable(doc, {
      startY: y,
      margin: { left: PAGE.l, right: PAGE.r, top: 0, bottom: 0 },
      head: [headRow],
      body,
      foot: [footerRow],
      showFoot: "lastPage",
      theme: "plain",
      styles: {
        fontSize: 7,
        cellPadding: 1.1,
        lineColor: C.border,
        lineWidth: 0.12,
        textColor: C.text,
        valign: "middle",
        overflow: "linebreak",
      },
      headStyles: {
        fillColor: C.tableBg,
        textColor: [55, 65, 81],
        fontStyle: "bold",
        fontSize: 6.5,
        halign: "center",
        cellPadding: { top: 1.5, bottom: 1.5, left: 1, right: 1 },
      },
      footStyles: {
        fillColor: C.tableBg,
        textColor: C.muted,
        fontStyle: "bold",
        fontSize: 6.5,
        halign: "center",
        lineColor: C.border,
        lineWidth: 0.12,
      },
      columnStyles: {
        0: { halign: "left",   cellWidth: col0W    },
        1: { halign: "center", cellWidth: levelColW },
        2: { halign: "center", cellWidth: levelColW },
        3: { halign: "center", cellWidth: levelColW },
        4: { halign: "center", cellWidth: levelColW },
        5: { halign: "center", cellWidth: levelColW },
      },
      didParseCell: (data) => {
        const col = data.column.index
        if (col === 0) {
          data.cell.styles.fillColor = C.tableBg
          if (data.section === "foot") {
            data.cell.styles.halign = "left"
            data.cell.styles.textColor = C.muted
          }
          return
        }
        const lvl = col - 1
        const fillBase = LEVEL_FILL[lvl]!
        const textBase = LEVEL_TEXT_COLOR[lvl]!
        if (data.section === "head") {
          data.cell.styles.fillColor = fillBase
          data.cell.styles.textColor = textBase
        } else if (data.section === "body") {
          // Versão mais clara para células do corpo
          const lighten = (n: number) =>
            Math.min(255, Math.round(n + (255 - n) * 0.58))
          data.cell.styles.fillColor = [
            lighten(fillBase[0]),
            lighten(fillBase[1]),
            lighten(fillBase[2]),
          ] as [number, number, number]
          if (data.cell.raw === "✓") {
            data.cell.styles.textColor = textBase
            data.cell.styles.fontStyle = "bold"
            data.cell.styles.fontSize = 8.5
          }
        } else if (data.section === "foot") {
          data.cell.styles.fillColor = fillBase
          data.cell.styles.textColor = textBase
          data.cell.styles.fontStyle = "bold"
        }
      },
      tableLineWidth: 0.15,
      tableLineColor: C.border,
      showHead: "everyPage",
    })

    const d = doc as DocWithTable
    y = (d.lastAutoTable?.finalY ?? y) + (isLast ? 0 : 4)
  }

  // ── 5. RODAPÉ DA PÁGINA ──────────────────────────────────────────────────
  doc.setFont("helvetica", "normal")
  doc.setFontSize(6.8)
  doc.setTextColor(...C.faint)
  doc.text(
    `QAgrotis  ·  Gerado em ${nowStr}  ·  Avaliador: ${meta.evaluatorName}`,
    pageW / 2,
    pageH - PAGE.b + 4,
    { align: "center" },
  )

  const out = doc.output("arraybuffer")
  return Buffer.from(new Uint8Array(out as ArrayBuffer))
}
