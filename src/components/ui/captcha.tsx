"use client"

import {
  useRef,
  useEffect,
  useCallback,
  useState,
  forwardRef,
  useImperativeHandle,
  useId,
} from "react"
import { RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"

const CHARS = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"

function generateCode(length = 5): string {
  return Array.from(
    { length },
    () => CHARS[Math.floor(Math.random() * CHARS.length)]
  ).join("")
}

function drawCaptcha(canvas: HTMLCanvasElement, code: string) {
  const ctx = canvas.getContext("2d")
  if (!ctx) return
  const W = canvas.width
  const H = canvas.height

  ctx.fillStyle = "#f8f9fc"
  ctx.fillRect(0, 0, W, H)

  for (let i = 0; i < 6; i++) {
    ctx.beginPath()
    ctx.moveTo(Math.random() * W, Math.random() * H)
    ctx.lineTo(Math.random() * W, Math.random() * H)
    ctx.strokeStyle = `rgba(0,115,93,${(Math.random() * 0.2 + 0.08).toFixed(2)})`
    ctx.lineWidth = 1.5
    ctx.stroke()
  }

  for (let i = 0; i < 40; i++) {
    ctx.beginPath()
    ctx.arc(Math.random() * W, Math.random() * H, Math.random() * 1.5 + 0.5, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(50,62,72,${(Math.random() * 0.15).toFixed(2)})`
    ctx.fill()
  }

  const slot = W / (code.length + 1)
  code.split("").forEach((char, i) => {
    ctx.save()
    const size = Math.floor(Math.random() * 6) + 20
    ctx.font = `bold ${size}px Arial, sans-serif`
    ctx.fillStyle = `hsl(${Math.random() > 0.5 ? 168 : 160}, 100%, 20%)`
    ctx.translate(
      slot * (i + 0.8) + (Math.random() * 6 - 3),
      H / 2 + size / 3 + (Math.random() * 6 - 3)
    )
    ctx.rotate((Math.random() - 0.5) * 0.45)
    ctx.fillText(char, 0, 0)
    ctx.restore()
  })
}

export interface CaptchaHandle {
  /** Returns true if the user's answer matches the code */
  isValid: () => boolean
  /** Generates a new code and clears the input */
  reset: () => void
}

interface CaptchaProps {
  label?: string
  placeholder?: string
  error?: string
  className?: string
}

export const Captcha = forwardRef<CaptchaHandle, CaptchaProps>(
  function Captcha(
    {
      label = "Confirme que você não é um robô",
      placeholder = "Digite os caracteres acima",
      error,
      className,
    },
    ref
  ) {
    const inputId = useId()
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const [code, setCode] = useState(() => generateCode())

    useEffect(() => {
      if (canvasRef.current) drawCaptcha(canvasRef.current, code)
    }, [code])

    const reset = useCallback(() => {
      setCode(generateCode())
      if (inputRef.current) inputRef.current.value = ""
    }, [])

    useImperativeHandle(ref, () => ({
      isValid: () =>
        (inputRef.current?.value ?? "").trim().toLowerCase() === code.toLowerCase(),
      reset,
    }), [code, reset])

    return (
      <div className={cn("space-y-1.5", className)}>
        <label htmlFor={inputId} className="block text-sm font-medium text-text-primary">
          {label}
        </label>

        {/* Canvas + refresh */}
        <div className="flex items-center gap-2">
          <canvas
            ref={canvasRef}
            width={168}
            height={52}
            aria-label="Imagem de verificação CAPTCHA"
            className="rounded-custom border border-border-default bg-surface-input select-none"
          />
          <button
            type="button"
            onClick={reset}
            aria-label="Gerar nova imagem"
            title="Nova imagem"
            className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border-default bg-surface-input text-text-secondary transition-colors hover:bg-neutral-grey-100"
          >
            <RefreshCw className="size-4" />
          </button>
        </div>

        {/* Answer input */}
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          placeholder={placeholder}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-err` : undefined}
          className={cn(
            "flex h-11 w-full rounded-custom border border-border-default bg-surface-input",
            "px-3 text-sm text-text-primary outline-none transition-colors",
            "placeholder:text-text-secondary",
            "focus-visible:border-brand-primary focus-visible:ring-2 focus-visible:ring-brand-primary/20",
            error && "border-destructive ring-2 ring-destructive/20"
          )}
        />

        {error && (
          <p id={`${inputId}-err`} role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
      </div>
    )
  }
)
