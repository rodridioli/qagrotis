"use client"

import { cn } from "@/core/utils"

export function UserAvatar({
  name,
  photoPath,
  size,
  inactive = false,
  className,
}: {
  name: string
  photoPath: string | null
  size: number
  inactive?: boolean
  className?: string
}) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
  const cls = cn(
    "flex-shrink-0 rounded-full object-cover ring-2 ring-border-default",
    inactive && "grayscale",
    className,
  )
  if (photoPath) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoPath}
        alt={name}
        className={cls}
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <div
      className={cn(
        cls,
        "flex items-center justify-center bg-neutral-grey-100 text-sm font-semibold text-text-primary",
        inactive && "opacity-80",
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.34) }}
    >
      {initials}
    </div>
  )
}

export function cargoLabel(classificacao: string | null): string {
  const c = (classificacao ?? "").trim()
  if (c) return c
  return "Colaborador"
}
