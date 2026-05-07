import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

function _validateCpf(cpf: string): boolean {
  if (/^(\d)\1{10}$/.test(cpf)) return false
  let sum = 0
  for (let i = 0; i < 9; i++) sum += parseInt(cpf[i]) * (10 - i)
  let rem = (sum * 10) % 11
  if (rem === 10 || rem === 11) rem = 0
  if (rem !== parseInt(cpf[9])) return false
  sum = 0
  for (let i = 0; i < 10; i++) sum += parseInt(cpf[i]) * (11 - i)
  rem = (sum * 10) % 11
  if (rem === 10 || rem === 11) rem = 0
  return rem === parseInt(cpf[10])
}

function _validateCnpj(cnpj: string): boolean {
  if (/^(\d)\1{13}$/.test(cnpj)) return false
  const calc = (weights: number[]) => {
    let s = 0
    for (let i = 0; i < weights.length; i++) s += parseInt(cnpj[i]) * weights[i]
    const r = s % 11
    return r < 2 ? 0 : 11 - r
  }
  const d1 = calc([5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  if (d1 !== parseInt(cnpj[12])) return false
  const d2 = calc([6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  return d2 === parseInt(cnpj[13])
}

export function validateCpfCnpj(value: string): boolean {
  const digits = value.replace(/\D/g, "")
  if (digits.length === 11) return _validateCpf(digits)
  if (digits.length === 14) return _validateCnpj(digits)
  return false
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
