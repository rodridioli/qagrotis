"use client"

import React, { createContext, useContext } from "react"

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

export function SistemaSelecionadoProvider({ children, value }: { children: React.ReactNode; value?: SistemaContextValue }) {
  const [sistema, setSistema] = React.useState(value?.sistemaSelecionado ?? "")
  return (
    <SistemaContext.Provider value={value ?? { sistemaSelecionado: sistema, setSistemaSelecionado: setSistema }}>
      {children}
    </SistemaContext.Provider>
  )
}
