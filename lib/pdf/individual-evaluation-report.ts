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
  evaluatedPhotoDataUrl?: string | null
}

// ── AGROTIS logo (SVG→PNG 3×, 783×144 px) ──────────────────────────────────
const AGROTIS_LOGO_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAw8AAACQCAYAAABOBFfdAAAACXBIWXMAAAsTAAALEwEAmpwYAAAgAElEQVR4nO2dCZRdVZWwTyIOrYg4IQrYDrRilNQ791ZCSN4514TL26cqCKLUL6burTBoHDCGujcBVOxCFBV/bduplW7xF9uhRUBoJ1pYyCAIiggikwgigsxhDCSQxH/tVwWdoZK8YZ/h3ra/tfaCBWvVO/fcfc7d+5w9CMG0xvIlO4siK0SeXiiK7F5RZH8vjeTZgyLPLhNFtlKMHfEifuUMwzAMwzAMY4siWyLybJV3J4DEkUhXizz7iBgfn84KwzAMwzAMwzCUFOknvBv8dm4jvi+Gh5/BysIwDMMwDMMwVDcOvo18u3ISKwrDMAzDMAzDdEv+zpdUJlRp67JOFEtiVhaGYRiGYRiG6YYi/WIAxr0DSS9gRWEYhmEYhmGYTjlq8WtEnq31b9g7cyDewsrCMAzDMAzDMJ1QZKf7N+gdSp7dIMaTHVhZGIZhGIZhGKYdxkbmiCLb4N2gdy1jo+9hRWEYhmEYhmGYdsjTX3o35P3cPtwtlo3sxMrCMAzDMAzDMK1QjB7s3Yj36kCkH2NFYRiGYRiGYZjtsXTpM0We/dG7Ae9XHhP5oXuwsjAMwzAMwzDMtshHlgdgvPuXPPs6KwrDMAzDMAzDrI3lS3YWRXavd8M9DFknxhbvzcrCMAzDMAzDMFNRZCcFYLSHI3n6U1YUhmEYhmEYhtmco0d2F3m62rvBHprk6UJWFoZhGIZhGIbZmCL9T++GephylRgfn87KwjAMwzAMwzDIWNon8nR9AIZ6mDKWjrKiMAzDMAzDMAySp+d6N9CDlvR2Mb70uawsDMMwDMMwTG9TjCzyb5yXQPLsWN+vimEYhmEYhmH8MTz8DJFn13g3zMsgefqw+OAhL2N1ZRiGYRiGYXqTFdm7vRvlZZI8+5LvV8YwDMMwDMMw7inS54ki+5t3g7xMkmdPiuXZG1hdGYZhGIZhmN6iyI73boyXUfL0DN+vjmEYhmEYhmHcUaS7NGP4fRviZZU8q7O6MkzYxAMDL4gVvLxfNfbYu77ohXEcP9P3mBiGYRimnBTZyZ4M79+LIjtJFNkSkWfDpRXsi8EwjE+m1epmRi2Bd8YKPhop861ImUulMndFyjwaafP3qUQq87jUcLNU5iKpzHekguOkarx9Zn3wdfg3+ZUyDMMwzOYUIzOasftuT+qvEUW6gF8GwzCd0q+NlHUzJjX8UCq4d2sOQqfS/JvKnB3rRiH1EOc2MU7Y05hnNx1hBQdG2ixFHY80fDhS8GmpzBcm/gnHoV42/79qvL02r9EXx/tz7yGmakzbOzG7x/XBebJuDpEacqnNR5prQMPnpTKfxX/HA6NYwbtiBYtwr+ZbZRcU6Y8cOw7fF8uWPdvJszEMUynQqJLanBAp80dqZ6EFZ+JP+LFCQ833PDDVYEaS7FhLYEAq+FikzLmRglsjDeu70NM7pDK/iJQ5Kao39sfwPN/PyDCtMnu22SnS5qBIw79EGi6QyjzY2TqAtZE2V0XafBVvo/dZsIDL6pMyNjrfcZjSz8V4sgPtQzBMuCRJskMzfAZDY1qQSMFPfY85NGbMGH6WTBqHRQp+59ph2KrgWBQcOXPhwueJgA3TidNpuACdrVZ1sBuJtLliQuC8SJvT8aRcajg61o3FE6fjnGeCIXGRNuNSm8ulMk/a1VV0ROBqdCbwpk4EwKz99nvxxPPDL5sOuQO9LIXUTdrNvA4PDz9DJpBJBT+Rylzf1rpV8CHhUR9k3SxrOgvaPGFrHUgFF0fKHFWrm5f6etZqMD4+XRTpFe5uHNKHxdjobr4fm2FcEik4tN2NrqYHB/ktTSQ4S22OwdNU787CVkRqc79U5sSZ+y7cJaR3hlf3kTJ/DnC+0Di4KlJwcq1uDkbDQfQAcu7AKyJlVkhtfut5/m+QCo6v6YF/8jIPGvaNNNzjWw+DFAVHdjqvfcmBO2PeVud6Af9XOCbSoKSCMydvCVzO85pIw/fi+tA+rp+5GoyNpm7DlUY+7PuRGcYleBLUUXiNMpf2+k3DhKEFD3n/oLf+zh5Bo2zu3AOe773+kmTHEB2HqQXWo76j4RQn+79EVIz+ZOGbpIZvOjeQWph3zBXCWHJXc9G3YNFuUpn7/D979ZwHvG3o5rddOg+RAsBbJ+/zPeFMn8NORDuML3mOyLNb3TkP6e1ifCknczE9RaTMSKebWqwbC0UPgrcueDrq+6PShdyNoQM+KzVhmFAA89DJh/yJSJkzYtWYLUpOTTXmYghipM0G3/PaghyCiaa256SZ7O3/WSvnPMQJvLn7tWffeZBJY0+pzY+8z/OWsgEd/FnJ0K6254DKw6NuLEOnYKXl6DkSJkIWtbhPqhNM3P8SHUiWFnQm+S92uW1dDgXaS3Og5I/B9umxFJKwPDmHpXRy1TlXkFQ/EzGRZIBSJiLYWz7EFHJ+VQ0lRNJlbNdJcbfJk3/M+Xv2VfV8bJfYAKjh4A0EYrNeHl2mP5JqoJR/bDuqpMCe4yH7Vs" +
  "oqPv2ikfKvMUAGqPJe0JeSRQ4GqtXVxD+7VtRR8fPbGNe9+oJVDr0FcOWPRkaqf1X8OAVlQ9sJvs6HXUeLbN24B5j6h1Pg9f2pRqMnGvgVhZ9Y3OO5Hbj5c7q0jze3O8F2VpIJbk7CJFMIkmQSyCRfqdSmVW6BH4lKUlqQMWRqSt2MJK5CqkmFX2EXBbw4MJZKkBq6fxIMKYB6B+3ij4Sb1F7sYfC" +
  "lOarFjb0mYr9Wnhfzz8IQdNniqtE2ZlZf9YVPRq0oPz6KFn5K4cQk8waqX/W+iQx4SbYGgL9J+q4V+LKMUGECWRuUqpqQqMQ5bAcIDUYqf6kUSTPSMsBiw/w3T+Qi+MgXqoUAW26Sq8Bq0pzf6CWLK5DuXmYkMnLQqmoPc2o1m3IpWyFj1nJ0iiNz1CPWPi0FBQ+5uPV3i9GWV2ER+m4rFsUKpCJTjXzHFCZNqnVtHCLtP3fB/Dc5qpkPiVGt3qV1xGjqnMDpaBcHLyG5WN9b5VNjN+rp9sRSUXEJUJrMM+n6MgbFOFCX+q8bCQzLY8tGd3Cd0yqv55UGvVMsKdLzgXvQipvCNaUBaFKfTDMfJAXSjblPfp4VqMC8lKJZJXNVUSKsrE1sF0xoqiN2ZipXA7tHFyXxPDY5u4DQOQmNyK0xwVr1IbPFqFIEv3RhfF3gE9FD9OJoAdB2sLzBcq7qiPmhOxGtlNKNeSvCJIqP7HagfCYLiKzHBzE3MFXJ3Uc0hFarI0L2BSxI72pVFB3MkJxzXG50PJCYb4aBVCMWCQdNSFHO1BLtOQlV6KgUJGKDl1e5xLBb5sKioPCoTPHXVCXTW7I4bvHf3Xse6pujFRiQX1X9oqiPAMFmeMhwGJyovBjFG0IVAkWJi9zfKmXiSrJq1OGDJq6qW/E7Ov5bBk1csMPKlPlXe4AJv4BLDmEIBM+jJVCEb1jQMPHsIGSwvOl1VoqoWbGdLRFLrMSfLG3H9XtO1SjKjXKMkKpRnqFG3U8h+lAHJKBg9pFJRKJ/UzBFGZ7IcK7mvhfcI9J7kEIKtNzQBlcUOSRzJoVIxCf0lD+peMZLlhCSMusmsMfV3bZFAF2rrBi8B0xmNZjOAUe4o4T6dNfK2s4TKv3ByDi0b5QDXDiW3yFjFqLwQfhqF7UIlrO9Hdb2kl6SKfDH8VsmvVCIAQlJ6mxb2yh5O7OJLZX5eoXR3eMKgJBiN/lkQ7VY6q5SiVuqgp39i8A2TYg7E7QeWJb5iBVdGnbxMMMEX7dPrWEFMvTxm0HaBlU1Kl0yz7JBfJqHgKtMwUdP85GJDzLkqeW2u1OuHI0Yir9E7PmxpM9SkWjkYVOJOb1K0pMHEf2GtRBQ9Cl8EF/S9Uy1PCOelVbKcqJoP8WJomr3WT9W7VxJqiPwC1nFUPT3XVNEWcbaqLWCGGFMVeMKJiSx1CPkZuJHtYMnC5oOg0hXpGLHrPflwxMhNTyizAiLa0vwR8KSYOYt0sU/CrMkYbPdCZ5aGOG7sCU7MVxBaMEJYFRBVGhMWCcXSyBdQqmqJWbHQYrjbSY2C1MHnj7kF2HilOqf7wVIiRZBiIg5j7BQ+NiBYpimFEVLKaTCdNkP1TcGE6rBGnuRzYZRFaknYSqHYHBMqd" +
  "FxKOiFVDzVxm7q0v5CwgTNBqsAYqBiV5oLkQEFaFVd4LTvXKF5YGN+AYb+BHsNBivpRomtxO7I2qLHLRFyCvb+Oj3CMUwSd3UZI0lNXdGS7g=="


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

  // Logo Agrotis à esquerda (PNG 783×144 px → escala para ~40×7.4 mm)
  const logoW = 40
  const logoH = logoW * (144 / 783) // ≈ 7.35 mm
  const logoX = PAGE.l + 4
  const logoY = y + (headerH - logoH) / 2
  doc.addImage(AGROTIS_LOGO_BASE64, "PNG", logoX, logoY, logoW, logoH)

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

  // Avatar círculo — foto real ou placeholder
  const aR = 9          // raio
  const aCx = c1x + 5 + aR
  const aCy = y + 6 + aR + 4  // centro vertical

  if (meta.evaluatedPhotoDataUrl) {
    // jsPDF não suporta clip circular nativo — foto inscrita no círculo com borda
    const imgD = aR * 1.414 // lado do quadrado inscrito no círculo
    doc.setFillColor(...C.card)
    doc.circle(aCx, aCy, aR + 0.5, "F")
    doc.setDrawColor(...C.border)
    doc.setLineWidth(0.3)
    doc.circle(aCx, aCy, aR + 0.5, "S")
    // Detect format: PNG starts 0x89, JPEG starts 0xFF
    const raw = meta.evaluatedPhotoDataUrl
    const isJpeg = raw.startsWith("data:image/jpeg") || raw.startsWith("data:image/jpg")
    const fmt = isJpeg ? "JPEG" : "PNG"
    const b64 = raw.replace(/^data:[^;]+;base64,/, "")
    doc.addImage(b64, fmt, aCx - imgD / 2, aCy - imgD / 2, imgD, imgD)
  } else {
    // Placeholder: círculo verde + silhueta de pessoa
    doc.setFillColor(...C.brand)
    doc.circle(aCx, aCy, aR, "F")
    // Cabeça
    doc.setFillColor(255, 255, 255)
    doc.circle(aCx, aCy - 2.8, 2.6, "F")
    // Corpo
    doc.setFillColor(255, 255, 255)
    doc.ellipse(aCx, aCy + 4.2, 4.0, 2.6, "F")
  }

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
