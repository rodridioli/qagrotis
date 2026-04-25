"use client"

import { createContext, useCallback, useContext, useState } from "react"

interface CommandBarContextValue {
  isOpen: boolean
  open: () => void
  close: () => void
  toggle: () => void
}

const CommandBarContext = createContext<CommandBarContextValue | null>(null)

export function CommandBarProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])
  const toggle = useCallback(() => setIsOpen((v) => !v), [])

  return (
    <CommandBarContext.Provider value={{ isOpen, open, close, toggle }}>
      {children}
    </CommandBarContext.Provider>
  )
}

export function useCommandBarContext() {
  const ctx = useContext(CommandBarContext)
  if (!ctx) throw new Error("useCommandBarContext must be used within CommandBarProvider")
  return ctx
}
