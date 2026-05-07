"use client"

import * as React from "react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/core/utils"

export interface BadgeAchievementProps {
  label: string
  icon: LucideIcon
  /** CSS variable expression — e.g. "var(--qagrotis-primary-500)" */
  color: string
  unlocked: boolean
  description?: string
}

export function BadgeAchievement({
  label,
  icon: Icon,
  color,
  unlocked,
  description,
}: BadgeAchievementProps) {
  const [animKey, setAnimKey] = React.useState(0)
  const [hovered, setHovered] = React.useState(false)
  const badgeRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (animKey === 0 || !badgeRef.current) return
    const el = badgeRef.current
    el.classList.remove("badge-hex-bounce")
    void el.offsetWidth
    el.classList.add("badge-hex-bounce")
  }, [animKey])

  function handleMouseEnter() {
    if (!unlocked) return
    setHovered(true)
    setAnimKey((k) => k + 1)
  }

  function handleMouseLeave() {
    setHovered(false)
  }

  const playing = animKey > 0

  // Color layers: outer = base color, inner = darker, arcs = darkest
  const outerFill = color
  const innerFill = `color-mix(in srgb, ${color} 76%, black)`
  const arcStroke = `color-mix(in srgb, ${color} 58%, black)`

  return (
    <div className="flex flex-col items-center gap-2.5" title={description}>
      <div
        ref={badgeRef}
        role="img"
        aria-label={`Conquista ${label} — ${unlocked ? "desbloqueada" : "bloqueada"}`}
        className="relative size-[5.5rem] cursor-default"
        style={{
          filter: !unlocked
            ? "grayscale(1) opacity(0.45)"
            : hovered
              ? `drop-shadow(0 8px 24px ${color})`
              : undefined,
          transition: "filter 300ms ease",
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Coin rings — SVG fills the container, viewBox 0 0 100 100 */}
        <svg viewBox="0 0 100 100" className="absolute inset-0 size-full" aria-hidden>
          {/* Outer circle (rim) */}
          <circle
            cx="50" cy="50" r="46"
            strokeWidth="4" strokeLinecap="round"
            style={{
              fill: unlocked ? outerFill : "var(--neutral-grey-300)",
              stroke: "white",
            }}
          />
          {/* Inner circle (face) */}
          <circle
            cx="50" cy="50" r="31"
            strokeWidth="4"
            style={{
              fill: unlocked ? innerFill : "var(--neutral-grey-400)",
              stroke: "white",
            }}
          />
          {/* Decorative arcs suggesting coin depth — left (lower) and right (upper) */}
          {unlocked && (
            <>
              <path
                d="M31.5,84.5 A40,40 0 0,1 10.2,55.0"
                fill="none" strokeWidth="5" strokeLinecap="round"
                style={{ stroke: arcStroke }}
              />
              <path
                d="M89.8,45.0 A40,40 0 0,1 68.5,15.5"
                fill="none" strokeWidth="5" strokeLinecap="round"
                style={{ stroke: arcStroke }}
              />
            </>
          )}
        </svg>

        {/* Sparkles */}
        {unlocked && (
          <>
            <span
              key={`s1-${animKey}`}
              className={cn(
                "pointer-events-none absolute left-2.5 top-3 select-none text-[7px] leading-none text-white/40",
                playing && "badge-spark-1",
              )}
              aria-hidden
            >
              ✦
            </span>
            <span
              key={`s2-${animKey}`}
              className={cn(
                "pointer-events-none absolute bottom-3 right-2.5 select-none text-[7px] leading-none text-white/40",
                playing && "badge-spark-2",
              )}
              aria-hidden
            >
              ✦
            </span>
          </>
        )}

        {/* Icon centered over SVG */}
        <span
          key={`icon-${animKey}`}
          className={cn(
            "absolute inset-0 flex items-center justify-center",
            playing && unlocked ? "badge-icon-turn" : "",
          )}
        >
          <Icon
            className={cn(
              "size-8 drop-shadow-sm",
              unlocked ? "text-white" : "text-neutral-grey-400",
            )}
            aria-hidden
          />
        </span>
      </div>

      <span
        className={cn(
          "max-w-[6rem] text-center text-xs leading-tight",
          unlocked ? "font-semibold text-text-primary" : "text-text-secondary",
        )}
      >
        {label}
      </span>
    </div>
  )
}
