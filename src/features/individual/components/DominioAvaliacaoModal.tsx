"use client"

import * as React from "react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import type {
  DominioProduto,
  DominioAvaliacaoResposta,
} from "@/features/individual/actions/individual-dominio"
import { cn } from "@/core/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  avaliacaoId: string
  configSnapshot: DominioProduto[]
  onSubmit: (id: string, respostas: DominioAvaliacaoResposta[]) => Promise<{ error?: string }>
}

// steps: 0 = intro, 1..N = produtos, N+1 = review, "done" = success
type Step = number | "done"

// ─── Design tokens (matching HTML prototype exactly) ─────────────────────────

const C = {
  green:      "#0E8C5C",
  green2:     "#0B7A4F",
  greenSoft:  "#E6F4EE",
  greenSoft2: "#D6EDE0",
  red:        "#E5484D",
  redSoft:    "#FDECEC",
  amber:      "#F5A524",
  amberSoft:  "#FEF3D7",
  star:       "#F2B33D",
  bg:         "#F4F5F7",
  panel:      "#FFFFFF",
  line:       "#E5E7EB",
  line2:      "#EEF0F3",
  ink:        "#111827",
  ink2:       "#374151",
  muted:      "#6B7280",
  muted2:     "#9CA3AF",
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseModulo(nome: string): { code: string | null; label: string } {
  if (/^Core\s*\/\s*ACC$/i.test(nome.trim())) return { code: "CORE", label: "ACC" }
  const m = /^([A-Z0-9]{2,6})\s*[-–]\s*(.+)$/.exec(nome)
  if (m) return { code: m[1]!, label: m[2]! }
  return { code: null, label: nome }
}

const NIVEL = ["Sem nota", "Iniciante", "Básico", "Intermediário", "Avançado", "Especialista"]

function produtoAvg(p: DominioProduto, r: Record<string, Record<string, number>>): number {
  const vals = p.modulos.map(m => r[p.id]?.[m.id] ?? 0).filter(Boolean)
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
}

function globalAvg(ps: DominioProduto[], r: Record<string, Record<string, number>>): number {
  const vals: number[] = []
  for (const p of ps) for (const m of p.modulos) { const v = r[p.id]?.[m.id]; if (v) vals.push(v) }
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
}

function isProdutoDone(p: DominioProduto, r: Record<string, Record<string, number>>) {
  return p.modulos.every(m => !!r[p.id]?.[m.id])
}

function riskOf(avg: number): { label: string; color: string } {
  if (avg === 0) return { label: "—",     color: C.muted2 }
  if (avg >= 4)  return { label: "Baixo", color: C.green }
  if (avg >= 2.5)return { label: "Médio", color: C.amber }
  return              { label: "Alto",  color: C.red }
}

function playSuccessChord() {
  if (typeof window === "undefined") return
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
  try {
    const AudioCtx = window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    for (const { freq, delay } of [{ freq: 523.25, delay: 0 }, { freq: 659.25, delay: 0.2 }, { freq: 783.99, delay: 0.4 }]) {
      const osc = ctx.createOscillator(); const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.type = "sine"; osc.frequency.value = freq
      const t = ctx.currentTime + delay
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.3, t + 0.01)
      gain.gain.setValueAtTime(0.3, t + 0.2)
      gain.gain.linearRampToValueAtTime(0, t + 0.35)
      osc.start(t); osc.stop(t + 0.4)
    }
    setTimeout(() => void ctx.close(), 1200)
  } catch { /* audio is enhancement only */ }
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────

function IcoLogo() {
  return (
    <svg viewBox="0 0 40 40" fill="none" width={36} height={36}>
      <path d="M20 4 L36 16 L30 16 L20 8.5 L10 16 L4 16 Z" fill={C.green} />
      <path d="M20 14 L34 24 L28 24 L20 18 L12 24 L6 24 Z" fill={C.green} opacity=".85" />
      <path d="M20 24 L32 32 L26 32 L20 27.5 L14 32 L8 32 Z" fill={C.green} opacity=".7" />
    </svg>
  )
}
const svgProps = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round" as const, strokeLinejoin: "round" as const, width: 18, height: 18 }
const IcoGrid   = () => <svg {...svgProps}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
const IcoRocket = () => <svg {...svgProps}><path d="M4.5 16.5L3 21l4.5-1.5"/><path d="M19.5 4.5C15 3 9 6 6 12l6 6c6-3 9-9 7.5-13.5z"/><circle cx="14.5" cy="9.5" r="1.5"/></svg>
const IcoDoc    = () => <svg {...svgProps}><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M8 13h8"/><path d="M8 17h5"/></svg>
const IcoSpark  = () => <svg {...svgProps}><path d="M12 3v3"/><path d="M12 18v3"/><path d="M3 12h3"/><path d="M18 12h3"/><path d="M5.6 5.6l2.1 2.1"/><path d="M16.3 16.3l2.1 2.1"/><path d="M5.6 18.4l2.1-2.1"/><path d="M16.3 7.7l2.1-2.1"/></svg>
const IcoUsers  = () => <svg {...svgProps}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
const IcoUser   = () => <svg {...svgProps}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
const IcoCog    = () => <svg {...svgProps}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
const IcoClock  = () => <svg {...svgProps}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
const IcoBell   = () => <svg {...svgProps}><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>
const IcoMoon   = () => <svg {...svgProps}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
const IcoPanel  = () => <svg {...svgProps}><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/></svg>
const IcoChevR  = () => <svg {...svgProps} strokeWidth="2"><path d="M9 6l6 6-6 6"/></svg>
const IcoChevL  = () => <svg {...svgProps} strokeWidth="2"><path d="M15 6l-6 6 6 6"/></svg>
const IcoChevD  = () => <svg {...svgProps} strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
const IcoCheck  = () => <svg {...svgProps} strokeWidth="2.2"><path d="M5 12.5L10 17.5L19.5 7.5"/></svg>
const IcoLogout = () => <svg {...svgProps}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>
const IcoTarget = () => <svg {...svgProps}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/></svg>
const IcoAlert  = () => <svg {...svgProps} strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>

function IcoStar({ filled, sm }: { filled: boolean; sm?: boolean }) {
  const sz = sm ? 14 : 22
  return (
    <svg viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor"
      strokeWidth="1.6" strokeLinejoin="round" width={sz} height={sz}>
      <path d="M12 3.2l2.65 5.37 5.93.86-4.29 4.18 1.01 5.9L12 16.73l-5.3 2.78 1.01-5.9L3.42 9.43l5.93-.86L12 3.2z" />
    </svg>
  )
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

function Sidebar({ onExit }: { onExit: () => void }) {
  const [openInd, setOpenInd] = React.useState(true)

  const navItem = (label: string, icon: React.ReactNode, active?: boolean, onClick?: () => void) => (
    <div
      key={label}
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 12, padding: "9px 12px",
        borderRadius: 10, color: active ? "#fff" : C.ink2,
        background: active ? C.green : "transparent",
        fontSize: 14, fontWeight: 500, cursor: "pointer",
        transition: "background .15s, color .15s",
      }}
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "#F3F4F6" }}
      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent" }}
    >
      <span style={{ width: 18, height: 18, color: active ? "#fff" : C.muted, display: "grid", placeItems: "center", flex: "0 0 18px" }}>{icon}</span>
      <span>{label}</span>
    </div>
  )

  return (
    <aside style={{ background: C.panel, borderRight: `1px solid ${C.line}`, padding: "22px 14px 16px", display: "flex", flexDirection: "column", height: "100%", overflowY: "auto" }}>
      {/* Brand */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 8px 26px" }}>
        <IcoLogo />
        <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: "0.02em", color: C.ink }}>AGROTIS</span>
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {navItem("Painel", <IcoGrid />)}
        {navItem("Suítes", <IcoRocket />)}
        {navItem("Cenários", <IcoDoc />)}
        {navItem("Gerador", <IcoSpark />)}
        {navItem("Equipe", <IcoUsers />)}

        {/* Individual (expandable) */}
        <div
          onClick={() => setOpenInd(o => !o)}
          style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 12px", borderRadius: 10, color: C.ink2, fontSize: 14, fontWeight: 500, cursor: "pointer", transition: "background .15s" }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#F3F4F6" }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent" }}
        >
          <span style={{ width: 18, height: 18, color: C.muted, display: "grid", placeItems: "center", flex: "0 0 18px" }}><IcoUser /></span>
          <span>Individual</span>
          <span style={{ marginLeft: "auto", color: C.muted2, transition: "transform .2s", transform: openInd ? "rotate(90deg)" : "none" }}><IcoChevR /></span>
        </div>

        {openInd && (
          <div style={{ paddingLeft: 36, display: "flex", flexDirection: "column", gap: 2 }}>
            {["Ficha", "Domínio", "Férias", "Ausências"].map(lbl => (
              <div key={lbl} style={{ padding: "7px 12px", borderRadius: 10, color: C.ink2, fontSize: 13.5, fontWeight: 500, cursor: "default" }}>{lbl}</div>
            ))}
            <div style={{ padding: "7px 12px", borderRadius: 10, background: C.green, color: "#fff", fontSize: 13.5, fontWeight: 500 }}>Avaliações</div>
            {["Feedbacks", "Conquistas", "PDI", "Progressão"].map(lbl => (
              <div key={lbl} style={{ padding: "7px 12px", borderRadius: 10, color: C.ink2, fontSize: 13.5, fontWeight: 500, cursor: "default" }}>{lbl}</div>
            ))}
          </div>
        )}

        {navItem("Configurações", <IcoCog />)}
        {navItem("Atualizações", <IcoClock />)}
      </nav>

      <div style={{ flex: 1 }} />

      <div style={{ borderTop: `1px solid ${C.line2}`, paddingTop: 12 }}>
        <div
          onClick={onExit}
          style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 12px", borderRadius: 10, color: C.red, fontWeight: 500, cursor: "pointer", fontSize: 14, transition: "background .15s" }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#FEF1F2" }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent" }}
        >
          <IcoLogout />
          <span>Sair do Sistema</span>
        </div>
      </div>
    </aside>
  )
}

// ─── Topbar ───────────────────────────────────────────────────────────────────

function Topbar({ title }: { title: string }) {
  return (
    <div style={{ height: 64, background: C.panel, borderBottom: `1px solid ${C.line}`, padding: "0 24px", display: "flex", alignItems: "center", gap: 16, flexShrink: 0, zIndex: 5 }}>
      <button style={{ width: 36, height: 36, borderRadius: 10, border: 0, background: "transparent", display: "grid", placeItems: "center", color: C.ink2, cursor: "pointer" }} aria-label="Recolher menu"><IcoPanel /></button>
      <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.01em", color: C.ink }}>{title}</span>
      <div style={{ flex: 1 }} />
      <button style={{ width: 36, height: 36, borderRadius: 10, border: 0, background: "transparent", display: "grid", placeItems: "center", color: C.ink2, cursor: "pointer" }} aria-label="Tema"><IcoMoon /></button>
      <div style={{ height: 38, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, padding: "0 14px", display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, fontWeight: 500, color: C.ink2 }}>
        <span style={{ color: C.muted }}>Sistema:</span>
        <span style={{ color: C.ink }}>Plataforma Agro</span>
        <IcoChevD />
      </div>
      <span style={{ height: 28, padding: "0 10px", borderRadius: 8, display: "inline-flex", alignItems: "center", fontSize: 12, fontWeight: 700, background: "#D6EDE0", color: C.green2 }}>QA</span>
      <div style={{ position: "relative" }}>
        <button style={{ width: 36, height: 36, borderRadius: 10, border: 0, background: "transparent", display: "grid", placeItems: "center", color: C.ink2, cursor: "pointer" }} aria-label="Notificações"><IcoBell /></button>
        <span style={{ position: "absolute", top: 6, right: 6, background: C.red, color: "#fff", fontSize: 10, fontWeight: 700, borderRadius: 999, minWidth: 16, height: 16, padding: "0 4px", display: "grid", placeItems: "center", border: "2px solid #fff" }}>3</span>
      </div>
      <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg,#B8E0CD,#E9D6C2)", border: "2px solid #fff", boxShadow: `0 0 0 1px ${C.line}`, display: "grid", placeItems: "center", fontWeight: 700, color: "#44513F", fontSize: 13, cursor: "pointer" }}>JA</div>
    </div>
  )
}

// ─── Stars ────────────────────────────────────────────────────────────────────

function Stars({ value, onChange, name }: { value: number; onChange: (v: number) => void; name: string }) {
  const [hover, setHover] = React.useState(0)
  const [pop, setPop] = React.useState(0)
  const display = hover || value

  function handleClick(i: number) {
    onChange(i)
    setPop(i)
    setTimeout(() => setPop(0), 500)
  }

  return (
    <div className="flex items-center" style={{ gap: 2 }} role="radiogroup" aria-label={`Avalie ${name}`}>
      {[1, 2, 3, 4, 5].map(i => {
        const lit = display >= i
        return (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={value === i}
            aria-label={`${i} estrela${i > 1 ? "s" : ""}`}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(0)}
            onClick={() => handleClick(i)}
            className={cn(pop === i && "ava-star-pop")}
            style={{
              width: 30, height: 30, padding: 0, background: "transparent", border: 0, cursor: "pointer",
              display: "grid", placeItems: "center", color: lit ? C.star : "#D1D5DB",
              borderRadius: 6, outline: "none",
              transition: "transform .15s cubic-bezier(.2,.8,.2,1), color .15s",
            }}
            onFocus={e => { (e.currentTarget as HTMLElement).style.outline = `2px solid ${C.green}40`; (e.currentTarget as HTMLElement).style.outlineOffset = "2px" }}
            onBlur={e => { (e.currentTarget as HTMLElement).style.outline = "none" }}
          >
            <span style={lit ? { filter: "drop-shadow(0 2px 6px #F2B33D55)" } : undefined}>
              <IcoStar filled={lit} />
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ─── Stepper ──────────────────────────────────────────────────────────────────

function Stepper({
  produtos, step, onClickStep,
}: {
  produtos: DominioProduto[]
  step: Step
  onClickStep: (s: Step) => void
}) {
  // 0=intro, 1..N=produtos, N+1=review
  const steps = [
    { label: "Introdução", idx: 0 },
    ...produtos.map((p, i) => ({ label: p.nome, idx: i + 1 })),
    { label: "Revisão", idx: produtos.length + 1 },
  ]
  const activeIdx = step === "done" ? produtos.length + 1 : (step as number)

  return (
    <div style={{
      background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: "14px 18px",
      display: "flex", alignItems: "center", gap: 8, marginBottom: 18, overflowX: "auto",
      boxShadow: "0 1px 0 #1118270d, 0 1px 2px #1118270a",
    }}>
      {steps.map((s, i) => {
        const isDone = s.idx < activeIdx
        const isActive = s.idx === activeIdx
        return (
          <React.Fragment key={s.idx}>
            <div
              onClick={() => onClickStep(s.idx as Step)}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "6px 10px",
                borderRadius: 8, cursor: "pointer", flexShrink: 0,
                transition: "background .15s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#F3F4F6" }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent" }}
            >
              <div style={{
                width: 24, height: 24, borderRadius: "50%", display: "grid", placeItems: "center",
                fontSize: 12, fontWeight: 700, flexShrink: 0,
                background: isActive ? C.green : isDone ? C.greenSoft2 : "#F3F4F6",
                color: isActive ? "#fff" : isDone ? C.green2 : C.muted,
                transition: "background .25s, color .25s",
              }}>
                {isDone
                  ? <span style={{ display: "flex" }}><IcoCheck /></span>
                  : String(i + 1).padStart(2, "0")}
              </div>
              <span style={{
                fontSize: 13.5, fontWeight: isActive ? 600 : 500, whiteSpace: "nowrap",
                color: isActive ? C.ink : isDone ? C.ink : C.ink2,
              }}>{s.label}</span>
            </div>
            {i < steps.length - 1 && (
              <div style={{ flex: "1 0 24px", height: 1, background: s.idx < activeIdx ? C.green : C.line, minWidth: 24 }} aria-hidden />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

// ─── IntroPane ────────────────────────────────────────────────────────────────

function IntroPane({ produtos, totalModulos }: { produtos: DominioProduto[]; totalModulos: number }) {
  const rateGroups = produtos.length
  return (
    <div className="ava-pane-in">
      <div className="ava-card-in" style={{
        background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12,
        boxShadow: "0 1px 0 #1118270d, 0 1px 2px #1118270a", padding: "36px 36px 32px",
        marginBottom: 18, overflow: "hidden", position: "relative",
      }}>
        {/* Radial glow */}
        <div style={{ position: "absolute", top: -120, right: -100, width: 360, height: 360, background: "radial-gradient(circle,#E6F4EE,transparent 70%)", pointerEvents: "none" }} aria-hidden />

        <span style={{
          display: "inline-flex", alignItems: "center", gap: 8, background: C.greenSoft,
          color: C.green2, border: `1px solid #C5E5D4`, padding: "5px 10px", borderRadius: 999,
          fontSize: 12, fontWeight: 600, letterSpacing: "0.02em",
        }}>
          <span className="ava-pulse-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: C.green, display: "inline-block" }} />
          Avaliação ativa
        </span>

        <h1 style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.1, margin: "16px 0 10px", color: C.ink }}>
          Avalie seu <span style={{ color: C.green2 }}>domínio técnico</span><br />em cada módulo do sistema.
        </h1>

        <p style={{ color: C.ink2, fontSize: 15, lineHeight: 1.55, maxWidth: "64ch", margin: 0 }}>
          Esta avaliação tem múltiplas etapas. Em cada item você atribui uma nota de 1 a 5 estrelas indicando o quanto domina o módulo. Leva cerca de <strong>4 minutos</strong> — você pode voltar e ajustar a qualquer momento.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginTop: 26, position: "relative" }}>
          {[
            { k: "Etapas",          v: rateGroups,   unit: "" },
            { k: "Itens p/ avaliar", v: totalModulos, unit: "" },
            { k: "Escala",           v: "1",          unit: "—5 estrelas" },
            { k: "Tempo médio",      v: "4",          unit: " min" },
          ].map(cell => (
            <div key={cell.k} style={{ border: `1px solid ${C.line}`, borderRadius: 10, padding: "14px 16px", background: "#fff" }}>
              <div style={{ fontSize: 12, color: C.muted, fontWeight: 500 }}>{cell.k}</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: C.ink, marginTop: 4, letterSpacing: "-0.01em" }}>
                {cell.v}<small style={{ fontSize: 13, color: C.muted, fontWeight: 500, marginLeft: 4 }}>{cell.unit}</small>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 24, flexWrap: "wrap" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, fontSize: 13, fontWeight: 500, background: C.greenSoft, color: C.green2, border: `1px solid #C5E5D4` }}>
            <IcoCheck /> Salvamento automático ativo
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, fontSize: 13, fontWeight: 500, background: C.amberSoft, color: "#8A5A14", border: `1px solid #F3D58A` }}>
            <IcoAlert /> Todos os itens são obrigatórios
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── RatePane ─────────────────────────────────────────────────────────────────

function RatePane({
  produto, produtoIdx, totalProdutos, respostas, onSetEstrelas,
}: {
  produto: DominioProduto
  produtoIdx: number
  totalProdutos: number
  respostas: Record<string, Record<string, number>>
  onSetEstrelas: (pid: string, mid: string, v: number) => void
}) {
  const [colData, setColData] = React.useState(false)
  const [colRate, setColRate] = React.useState(false)

  const vals = produto.modulos.map(m => respostas[produto.id]?.[m.id] ?? 0).filter(Boolean)
  const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
  const rated = produto.modulos.filter(m => !!respostas[produto.id]?.[m.id]).length
  const pct = rated / produto.modulos.length
  const risk = riskOf(avg)

  const cardStyle: React.CSSProperties = {
    background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12,
    boxShadow: "0 1px 0 #1118270d, 0 1px 2px #1118270a", overflow: "hidden", marginBottom: 18,
  }
  const headStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "18px 22px", cursor: "pointer", userSelect: "none",
  }

  return (
    <div className="ava-pane-in">
      {/* Dados da Etapa */}
      <div className="ava-card-in" style={cardStyle}>
        <div style={headStyle} onClick={() => setColData(c => !c)}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: C.ink, letterSpacing: "-0.005em" }}>Dados da Etapa</div>
            <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>{produto.nome}</div>
          </div>
          <div style={{ width: 32, height: 32, display: "grid", placeItems: "center", borderRadius: 8, color: C.muted, transition: "transform .25s", transform: colData ? "rotate(-180deg)" : "none" }}>
            <IcoChevD />
          </div>
        </div>
        {!colData && (
          <div style={{ borderTop: `1px solid ${C.line2}`, padding: 22 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(12,1fr)", gap: "18px 16px" }}>
              <div style={{ gridColumn: "span 12", display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ fontSize: 12.5, fontWeight: 500, color: C.ink2 }}>Avaliação</div>
                <div style={{ display: "flex", alignItems: "center", background: "#F8FAFB", border: `1px solid ${C.line}`, borderRadius: 8, padding: "9px 12px", color: C.ink2, fontSize: 13.5, minHeight: 38 }}>
                  Domínio Técnico — Avaliação {String(produtoIdx).padStart(2, "0")} de {String(totalProdutos).padStart(2, "0")}
                </div>
              </div>
              <div style={{ gridColumn: "span 4", display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ fontSize: 12.5, fontWeight: 500, color: C.ink2 }}>Sistema</div>
                <div style={{ display: "flex", alignItems: "center", background: "#F8FAFB", border: `1px solid ${C.line}`, borderRadius: 8, padding: "9px 12px", color: C.ink2, fontSize: 13.5, minHeight: 38 }}>Plataforma Agro</div>
              </div>
              <div style={{ gridColumn: "span 4", display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ fontSize: 12.5, fontWeight: 500, color: C.ink2 }}>Etapa</div>
                <div style={{ display: "flex", alignItems: "center", background: "#F8FAFB", border: `1px solid ${C.line}`, borderRadius: 8, padding: "9px 12px", color: C.ink2, fontSize: 13.5, minHeight: 38 }}>
                  {String(produtoIdx).padStart(2, "0")} — {produto.nome}
                </div>
              </div>
              <div style={{ gridColumn: "span 4", display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ fontSize: 12.5, fontWeight: 500, color: C.ink2 }}>Nível médio</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#F8FAFB", border: `1px solid ${C.line}`, borderRadius: 8, padding: "9px 12px", color: C.ink2, fontSize: 13.5, minHeight: 38 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: risk.color, display: "inline-block", flexShrink: 0 }} />
                  {risk.label}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Rating table */}
      <div className="ava-card-in" style={{ ...cardStyle, animationDelay: "60ms" }}>
        <div style={headStyle} onClick={() => setColRate(c => !c)}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: C.ink }}>Avalie seu domínio nos módulos</div>
            <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>Clique nas estrelas para atribuir uma nota de 1 a 5.</div>
          </div>
          <div style={{ width: 32, height: 32, display: "grid", placeItems: "center", borderRadius: 8, color: C.muted, transition: "transform .25s", transform: colRate ? "rotate(-180deg)" : "none" }}>
            <IcoChevD />
          </div>
        </div>
        {!colRate && (
          <div style={{ borderTop: `1px solid ${C.line2}`, padding: 22 }}>
            {/* Table */}
            <div style={{ display: "grid", gridTemplateColumns: "56px minmax(0,1fr) auto auto", border: `1px solid ${C.line}`, borderRadius: 12, overflow: "hidden", background: "#fff" }}>
              {/* Header */}
              {["Código", "Módulo", "Avaliação", "Nível"].map((h, hi) => (
                <div key={h} style={{ background: "#FAFBFC", color: C.muted, fontSize: 11.5, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", padding: "11px 14px", borderBottom: `1px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: hi >= 2 ? "flex-end" : "flex-start" }}>{h}</div>
              ))}
              {/* Rows */}
              {produto.modulos.map((modulo, mIdx) => {
                const { code, label } = parseModulo(modulo.nome)
                const v = respostas[produto.id]?.[modulo.id] ?? 0
                return (
                  <React.Fragment key={modulo.id}>
                    <div className="ava-row-in" style={{ padding: "14px", display: "flex", alignItems: "center", borderBottom: mIdx < produto.modulos.length - 1 ? `1px solid ${C.line2}` : "none", animationDelay: `${mIdx * 60}ms`, fontFamily: "ui-monospace, monospace", fontSize: 12, fontWeight: 600, color: C.green2 }}>
                      {code ?? "—"}
                    </div>
                    <div className="ava-row-in" style={{ padding: "14px", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2, borderBottom: mIdx < produto.modulos.length - 1 ? `1px solid ${C.line2}` : "none", animationDelay: `${mIdx * 60}ms` }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>{label}</span>
                    </div>
                    <div className="ava-row-in" style={{ padding: "14px", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 14, borderBottom: mIdx < produto.modulos.length - 1 ? `1px solid ${C.line2}` : "none", animationDelay: `${mIdx * 60}ms` }}>
                      <Stars value={v} onChange={val => onSetEstrelas(produto.id, modulo.id, val)} name={label} />
                    </div>
                    <div className="ava-row-in" style={{ padding: "14px", display: "flex", alignItems: "center", justifyContent: "flex-end", borderBottom: mIdx < produto.modulos.length - 1 ? `1px solid ${C.line2}` : "none", animationDelay: `${mIdx * 60}ms` }}>
                      <div style={{ textAlign: "right" }}>
                        <span style={{ fontSize: 18, fontWeight: 700, color: v ? C.ink : C.muted2 }}>{v ? v.toFixed(1) : "—"}</span>
                        <span style={{ display: "block", fontSize: 11.5, color: C.muted, marginTop: 2, fontWeight: 500 }}>{NIVEL[v]}</span>
                      </div>
                    </div>
                  </React.Fragment>
                )
              })}
            </div>

            {/* Summary row */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18, marginTop: 18, padding: "14px 18px", background: "#FAFBFC", border: `1px solid ${C.line}`, borderRadius: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 56, height: 56, borderRadius: 14, background: avg ? C.greenSoft : "#F3F4F6", color: avg ? C.green2 : C.muted2, display: "grid", placeItems: "center", fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>
                  {avg ? avg.toFixed(1) : "—"}
                </div>
                <div>
                  <div style={{ fontSize: 13, color: C.muted, fontWeight: 500 }}>Média desta etapa</div>
                  <div style={{ fontSize: 15, color: C.ink, fontWeight: 600 }}>{rated} de {produto.modulos.length} módulos avaliados</div>
                </div>
              </div>
              <div style={{ width: 220 }}>
                <div style={{ height: 8, borderRadius: 999, background: "#E5E7EB", overflow: "hidden" }}>
                  <div style={{ height: "100%", background: C.green, borderRadius: "inherit", width: `${pct * 100}%`, transition: "width .6s cubic-bezier(.2,.8,.2,1)" }} />
                </div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 6, textAlign: "right" }}>{Math.round(pct * 100)}% concluído</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── ReviewPane ───────────────────────────────────────────────────────────────

function ReviewPane({
  produtos, respostas, submitting, onEdit, onConfirm,
}: {
  produtos: DominioProduto[]
  respostas: Record<string, Record<string, number>>
  submitting: boolean
  onEdit: (idx: number) => void
  onConfirm: () => void
}) {
  const allModulos = produtos.flatMap(p => p.modulos)
  const overall = globalAvg(produtos, respostas)
  const done = allModulos.filter(m => {
    const p = produtos.find(p => p.modulos.some(mm => mm.id === m.id))
    return p ? !!respostas[p.id]?.[m.id] : false
  }).length
  const missing = allModulos.length - done
  const etapasDone = produtos.filter(p => isProdutoDone(p, respostas)).length

  const statCard = (k: string, v: string, sub: string, ico: React.ReactNode, bg: string, fg: string) => (
    <div key={k} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: "18px 20px", boxShadow: "0 1px 0 #1118270d, 0 1px 2px #1118270a", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
      <div>
        <div style={{ fontSize: 13.5, color: C.muted, fontWeight: 500 }}>{k}</div>
        <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", color: C.ink, marginTop: 4 }} dangerouslySetInnerHTML={{ __html: v }} />
        <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{sub}</div>
      </div>
      <div style={{ width: 38, height: 38, borderRadius: 10, background: bg, color: fg, display: "grid", placeItems: "center", flexShrink: 0 }}>{ico}</div>
    </div>
  )

  return (
    <div className="ava-pane-in">
      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 18 }}>
        {statCard("Domínio geral", `${overall ? overall.toFixed(2) : "—"}<small style="font-size:14px;color:${C.muted};font-weight:500;margin-left:4px">/5</small>`, overall >= 4 ? "Excelente" : overall >= 3 ? "Bom" : overall >= 2 ? "Em desenvolvimento" : overall > 0 ? "Inicial" : "Não avaliado", <IcoTarget />, C.greenSoft, C.green)}
        {statCard("Módulos avaliados", `${done}<small style="font-size:14px;color:${C.muted};font-weight:500;margin-left:4px">/${allModulos.length}</small>`, `${Math.round((done / allModulos.length) * 100)}% concluído`, <IcoCheck />, "#E0EEFD", "#1763CF")}
        {statCard("Etapas cobertas", `${etapasDone}<small style="font-size:14px;color:${C.muted};font-weight:500;margin-left:4px">/${produtos.length}</small>`, "Etapas com 100% de avaliação", <IcoDoc />, "#EFE6FB", "#6B3CB7")}
        {statCard("Pendentes", String(missing), missing === 0 ? "Pronto para envio" : "Itens sem nota", <IcoAlert />, C.amberSoft, "#B47410")}
      </div>

      {/* Per-product review */}
      {produtos.map((produto, pIdx) => {
        const avg = produtoAvg(produto, respostas)
        const vals = produto.modulos.filter(m => !!respostas[produto.id]?.[m.id]).length
        return (
          <div key={produto.id} className="ava-card-in" style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, boxShadow: "0 1px 0 #1118270d, 0 1px 2px #1118270a", marginBottom: 18, animationDelay: `${pIdx * 80}ms` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", cursor: "default" }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: C.ink }}>{produto.nome}</div>
                <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>Média: {avg ? avg.toFixed(2) : "—"} · {vals}/{produto.modulos.length} avaliados</div>
              </div>
              <button
                onClick={() => onEdit(pIdx + 1)}
                style={{ height: 38, padding: "0 16px", borderRadius: 10, border: `1px solid ${C.line}`, background: "transparent", color: C.ink2, fontSize: 13.5, fontWeight: 600, cursor: "pointer", transition: "background .15s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#F9FAFB" }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent" }}
              >
                Editar
              </button>
            </div>
            <div style={{ borderTop: `1px solid ${C.line2}`, padding: 22 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12 }}>
                {produto.modulos.map(modulo => {
                  const { code, label } = parseModulo(modulo.nome)
                  const v = respostas[produto.id]?.[modulo.id] ?? 0
                  return (
                    <div key={modulo.id} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: "16px 18px", display: "flex", alignItems: "center", gap: 14, transition: "border-color .15s, box-shadow .15s" }}>
                      <div style={{ width: 48, height: 48, borderRadius: 12, background: v ? C.greenSoft : "#F3F4F6", color: v ? C.green2 : C.muted2, display: "grid", placeItems: "center", fontSize: 18, fontWeight: 700, flexShrink: 0 }}>{v || "—"}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: C.green2, fontWeight: 600 }}>{code}</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
                        <div style={{ display: "inline-flex", gap: 1, color: C.star, marginTop: 2 }}>
                          {[1, 2, 3, 4, 5].map(i => (
                            <span key={i} style={{ color: i <= v ? C.star : C.line }}><IcoStar filled={i <= v} sm /></span>
                          ))}
                          <span style={{ fontSize: 12, color: C.muted, marginLeft: 8, fontWeight: 500 }}>{NIVEL[v]}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── DonePane ─────────────────────────────────────────────────────────────────

function DonePane({ overall, onRestart, onClose }: { overall: number; onRestart: () => void; onClose: () => void }) {
  return (
    <div className="ava-pane-in">
      <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, boxShadow: "0 1px 0 #1118270d, 0 1px 2px #1118270a", padding: "64px 32px", textAlign: "center" }}>
        <div className="ava-done-in" style={{ width: 84, height: 84, borderRadius: "50%", background: C.greenSoft, color: C.green, display: "grid", placeItems: "center", margin: "0 auto 22px" }}>
          <span style={{ display: "flex" }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width={40} height={40}><path d="M5 12.5L10 17.5L19.5 7.5" /></svg></span>
        </div>
        <h2 style={{ fontSize: 28, fontWeight: 700, margin: "0 0 8px", color: C.ink, letterSpacing: "-0.01em" }}>Avaliação enviada com sucesso</h2>
        <p style={{ color: C.muted, maxWidth: "56ch", margin: "0 auto", fontSize: 15, lineHeight: 1.55 }}>
          Obrigado por completar a avaliação. Seu domínio geral foi de <strong>{overall.toFixed(2)}/5</strong>. Você pode revisar suas respostas a qualquer momento dentro de <strong>Individual › Avaliações</strong>.
        </p>
        <div style={{ marginTop: 28, display: "inline-flex", gap: 10 }}>
          <button onClick={onRestart} style={{ height: 38, padding: "0 16px", borderRadius: 10, border: `1px solid ${C.line}`, background: "transparent", color: C.ink2, fontSize: 13.5, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", transition: "background .15s" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#F9FAFB" }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent" }}>
            <IcoChevL /> Refazer avaliação
          </button>
          <button onClick={onClose} style={{ height: 38, padding: "0 16px", borderRadius: 10, border: 0, background: C.green, color: "#fff", fontSize: 13.5, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", transition: "background .15s" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.green2 }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = C.green }}>
            Ir para o Painel <IcoChevR />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Exit Confirm ─────────────────────────────────────────────────────────────

function ExitConfirm({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 20, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.4)" }} aria-live="assertive">
      <div role="alertdialog" aria-modal="true" aria-labelledby="exit-title" style={{ background: "#fff", borderRadius: 16, padding: 24, maxWidth: 380, width: "calc(100% - 32px)", boxShadow: "0 8px 32px #00000028" }}>
        <h2 id="exit-title" style={{ fontSize: 16, fontWeight: 600, color: C.ink, margin: 0 }}>Sair da avaliação?</h2>
        <p style={{ fontSize: 14, color: C.muted, marginTop: 6, marginBottom: 20 }}>Seu progresso não será salvo.</p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
          <button autoFocus onClick={onCancel} style={{ height: 38, padding: "0 16px", borderRadius: 10, border: `1px solid ${C.line}`, background: "transparent", color: C.ink2, fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>
            Continuar avaliação
          </button>
          <button onClick={onConfirm} style={{ height: 38, padding: "0 16px", borderRadius: 10, border: 0, background: C.red, color: "#fff", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>
            Sair mesmo assim
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function DominioAvaliacaoModal({ avaliacaoId, configSnapshot, onSubmit }: Props) {
  const router = useRouter()
  const produtos = React.useMemo(() => configSnapshot.filter(p => p.modulos.length > 0), [configSnapshot])
  const totalModulos = produtos.reduce((a, p) => a + p.modulos.length, 0)
  // steps: 0=intro, 1..N=produtos, N+1=review, "done"=success
  const reviewStep = produtos.length + 1

  const [step, setStep] = React.useState<Step>(0)
  const [respostas, setRespostas] = React.useState<Record<string, Record<string, number>>>({})
  const [submitting, setSubmitting] = React.useState(false)
  const [overall, setOverall] = React.useState(0)
  const [showExit, setShowExit] = React.useState(false)
  const [exiting, setExiting] = React.useState(false)

  // Keyboard shortcuts: Enter to advance, Ctrl/Cmd+← →
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (showExit) return
      const tag = (e.target as HTMLElement).tagName.toLowerCase()
      if (tag === "input" || tag === "textarea") return
      if (e.key === "ArrowLeft"  && (e.metaKey || e.ctrlKey)) goBack()
      if (e.key === "ArrowRight" && (e.metaKey || e.ctrlKey)) { if (canAdvance()) goNext() }
      if (e.key === "Escape" && step !== "done") setShowExit(v => !v)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  function setEstrelas(pid: string, mid: string, v: number) {
    setRespostas(prev => ({ ...prev, [pid]: { ...(prev[pid] ?? {}), [mid]: v } }))
  }

  function canAdvance(): boolean {
    if (step === "done") return false
    const s = step as number
    if (s === 0 || s === reviewStep) return true
    const p = produtos[s - 1]
    return p ? isProdutoDone(p, respostas) : true
  }

  function goNext() {
    if (step === "done") return
    const s = step as number
    if (s < reviewStep) setStep(s + 1)
  }

  function goBack() {
    if (step === "done" || step === 0) return
    setStep((step as number) - 1)
  }

  function handleEdit(targetStep: number) { setStep(targetStep) }

  function handleRestart() { setRespostas({}); setStep(0) }

  function handleExit() { setExiting(true); setTimeout(() => router.refresh(), 250) }

  async function handleConfirm() {
    if (submitting) return
    setSubmitting(true)
    const flat: DominioAvaliacaoResposta[] = []
    for (const p of produtos) for (const m of p.modulos) {
      const estrelas = respostas[p.id]?.[m.id]
      if (estrelas) flat.push({ produtoId: p.id, moduloId: m.id, estrelas })
    }
    const res = await onSubmit(avaliacaoId, flat)
    setSubmitting(false)
    if (res.error) { toast.error(res.error); return }
    setOverall(globalAvg(produtos, respostas))
    playSuccessChord()
    setStep("done")
    toast.success("Avaliação de domínio concluída!")
  }

  const currentStep = step as number
  const isIntro  = step !== "done" && currentStep === 0
  const isRate   = step !== "done" && currentStep >= 1 && currentStep <= produtos.length
  const isReview = step !== "done" && currentStep === reviewStep
  const isDone   = step === "done"

  const currentProduto = isRate ? produtos[currentStep - 1] : null

  // Action bar state
  const canNext = canAdvance()
  let actionMsg: React.ReactNode = null
  if (isIntro)  actionMsg = <span>Pronto para começar?</span>
  if (isRate && currentProduto) {
    const p = currentProduto
    actionMsg = canNext
      ? <><strong style={{ color: C.ink }}>Etapa completa.</strong> Avance para a próxima.</>
      : <>Avalie todos os <strong style={{ color: C.ink }}>{p.modulos.length} módulos</strong> desta etapa para continuar.</>
  }
  if (isReview) {
    const allDone = produtos.every(p => isProdutoDone(p, respostas))
    actionMsg = allDone
      ? <><strong style={{ color: C.ink }}>Tudo pronto.</strong> Envie sua avaliação.</>
      : <>Faltam itens por avaliar — volte e complete antes de enviar.</>
  }

  const pageTitle = isDone ? "Avaliações" : "Avaliações — Domínio Técnico"

  const btnStyle = (primary: boolean, disabled?: boolean): React.CSSProperties => ({
    height: 38, padding: "0 16px", borderRadius: 10,
    border: primary ? 0 : `1px solid ${C.line}`,
    background: disabled ? (primary ? "#6BAE90" : "transparent") : primary ? C.green : "transparent",
    color: primary ? "#fff" : C.ink2,
    fontSize: 13.5, fontWeight: 600,
    display: "inline-flex", alignItems: "center", gap: 8,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
    transition: "background .15s, box-shadow .15s",
  })

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        display: "grid", gridTemplateColumns: "240px 1fr",
        background: C.bg, fontFamily: '"Inter", ui-sans-serif, system-ui, -apple-system, sans-serif',
        fontSize: 14, lineHeight: 1.45, color: C.ink,
        WebkitFontSmoothing: "antialiased",
        opacity: exiting ? 0 : 1, transition: exiting ? "opacity .2s" : undefined,
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ava-modal-title"
    >
      {/* Sidebar */}
      <Sidebar onExit={() => setShowExit(true)} />

      {/* Main */}
      <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", position: "relative", minWidth: 0 }}>
        <Topbar title={pageTitle} />

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "22px 28px", paddingBottom: isDone ? 40 : 88 }}>
          {/* Crumb row */}
          {!isDone && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: C.muted }}>
                <button onClick={goBack} style={{ width: 28, height: 28, display: "grid", placeItems: "center", borderRadius: 8, border: 0, background: "transparent", color: C.ink2, cursor: "pointer" }} title="Voltar"><IcoChevL /></button>
                <span style={{ cursor: "pointer" }} onClick={() => setStep(0)}>Avaliações</span>
                <span style={{ color: C.muted2 }}>/</span>
                <span>Domínio</span>
                <span style={{ color: C.muted2 }}>/</span>
                <span style={{ color: C.ink, fontWeight: 600 }}>
                  {isIntro ? "Introdução" : isRate && currentProduto ? currentProduto.nome : "Revisão"}
                </span>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                {isReview && (
                  <button
                    disabled={submitting || !produtos.every(p => isProdutoDone(p, respostas))}
                    onClick={() => void handleConfirm()}
                    style={btnStyle(true, submitting || !produtos.every(p => isProdutoDone(p, respostas)))}
                    onMouseEnter={e => { if (!submitting) (e.currentTarget as HTMLElement).style.background = C.green2 }}
                    onMouseLeave={e => { if (!submitting) (e.currentTarget as HTMLElement).style.background = C.green }}
                  >
                    {submitting ? "Enviando…" : <><span id="ava-modal-title">Enviar avaliação</span><IcoChevR /></>}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Stepper */}
          {!isDone && (
            <Stepper produtos={produtos} step={step} onClickStep={s => { if (typeof s === "number") setStep(s) }} />
          )}

          {/* Panes */}
          {isIntro && <IntroPane produtos={produtos} totalModulos={totalModulos} />}

          {isRate && currentProduto && (
            <RatePane
              key={currentStep}
              produto={currentProduto}
              produtoIdx={currentStep}
              totalProdutos={produtos.length}
              respostas={respostas}
              onSetEstrelas={setEstrelas}
            />
          )}

          {isReview && (
            <ReviewPane
              produtos={produtos}
              respostas={respostas}
              submitting={submitting}
              onEdit={handleEdit}
              onConfirm={() => void handleConfirm()}
            />
          )}

          {isDone && (
            <DonePane overall={overall} onRestart={handleRestart} onClose={handleExit} />
          )}
        </div>

        {/* Action bar */}
        {!isDone && (
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0,
            background: "rgba(255,255,255,0.92)",
            borderTop: `1px solid ${C.line}`,
            backdropFilter: "saturate(160%) blur(10px)",
            WebkitBackdropFilter: "saturate(160%) blur(10px)",
            zIndex: 4,
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 28px" }}>
              <div style={{ fontSize: 13, color: C.muted }}>{actionMsg}</div>
              <div style={{ display: "flex", gap: 10 }}>
                {currentStep > 0 && (
                  <button onClick={goBack} style={btnStyle(false)}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#F9FAFB" }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent" }}>
                    <IcoChevL /> Voltar
                  </button>
                )}
                {!isReview && (
                  <button onClick={goNext} disabled={!canNext} style={btnStyle(true, !canNext)}
                    onMouseEnter={e => { if (canNext) (e.currentTarget as HTMLElement).style.background = C.green2 }}
                    onMouseLeave={e => { if (canNext) (e.currentTarget as HTMLElement).style.background = C.green }}>
                    {isIntro ? "Começar" : "Próxima etapa"} <IcoChevR />
                  </button>
                )}
                {isReview && (
                  <button
                    onClick={() => void handleConfirm()}
                    disabled={submitting || !produtos.every(p => isProdutoDone(p, respostas))}
                    style={btnStyle(true, submitting || !produtos.every(p => isProdutoDone(p, respostas)))}
                    onMouseEnter={e => { if (!submitting) (e.currentTarget as HTMLElement).style.background = C.green2 }}
                    onMouseLeave={e => { if (!submitting) (e.currentTarget as HTMLElement).style.background = C.green }}>
                    {submitting ? "Enviando…" : <><span>Enviar avaliação</span><IcoChevR /></>}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Exit confirm */}
      {showExit && <ExitConfirm onCancel={() => setShowExit(false)} onConfirm={handleExit} />}
    </div>
  )
}
