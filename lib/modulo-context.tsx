"use client"

import { createContext, useContext } from "react"

interface SistemaContextValue {
  sistemaSelecionado: string
  setSistemaSelecionado: (v: string) => void
}

export const SistemaContext = createContext<SistemaContextValue>({
  sistemaSelecionado: "",
  setSistemaSelecionado: () => {},
})

export function useSistemaSelecionado() {
  return useContext(SistemaContext)
}
