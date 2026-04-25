"use client"

import { Mic, MicOff, Square } from "lucide-react"
import { cn } from "@/lib/utils"

interface VoiceButtonProps {
  isListening: boolean
  isSupported: boolean
  onStart: () => void
  onStop: () => void
  size?: "sm" | "md"
  className?: string
}

export function VoiceButton({ isListening, isSupported, onStart, onStop, size = "md", className }: VoiceButtonProps) {
  const iconSize = size === "sm" ? "size-3.5" : "size-4"
  const btnSize = size === "sm" ? "size-6" : "size-8"

  if (!isSupported) {
    return (
      <button
        type="button"
        disabled
        title="Reconhecimento de voz não disponível neste navegador"
        aria-label="Reconhecimento de voz não disponível"
        className={cn("flex items-center justify-center rounded text-text-secondary opacity-40 cursor-not-allowed", btnSize, className)}
      >
        <MicOff className={iconSize} aria-hidden="true" />
      </button>
    )
  }

  if (isListening) {
    return (
      <button
        type="button"
        onClick={onStop}
        aria-label="Parar gravação de voz"
        className={cn(
          "relative flex items-center justify-center rounded text-destructive transition-colors hover:bg-destructive/10",
          btnSize,
          className,
        )}
      >
        <span className="absolute inset-0 animate-ping rounded bg-destructive/20" aria-hidden="true" />
        <Square className={cn("relative fill-current", size === "sm" ? "size-3" : "size-3.5")} aria-hidden="true" />
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onStart}
      aria-label="Iniciar entrada de voz"
      className={cn(
        "flex items-center justify-center rounded text-text-secondary transition-colors hover:bg-neutral-grey-100 hover:text-brand-primary",
        btnSize,
        className,
      )}
    >
      <Mic className={iconSize} aria-hidden="true" />
    </button>
  )
}
