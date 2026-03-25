import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCpfCnpj(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 14)
  const n = d.length
  if (n <= 11) {
    if (n <= 3) return d
    if (n <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
    if (n <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
  }
  if (n <= 2) return d
  if (n <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`
  if (n <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`
  if (n <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}
