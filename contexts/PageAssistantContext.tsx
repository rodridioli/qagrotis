"use client"

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"
import type { PageAssistantPage } from "@/app/api/page-assistant/route"

export interface PageAssistantData {
  page: PageAssistantPage
  data: Record<string, unknown>
}

interface PageAssistantContextValue {
  pageData: PageAssistantData | null
  setPageData: (data: PageAssistantData | null) => void
}

const PageAssistantContext = createContext<PageAssistantContextValue | null>(null)

export function PageAssistantProvider({ children }: { children: ReactNode }) {
  const [pageData, setPageDataState] = useState<PageAssistantData | null>(null)

  const setPageData = useCallback((data: PageAssistantData | null) => {
    setPageDataState(data)
  }, [])

  const value = useMemo(() => ({ pageData, setPageData }), [pageData, setPageData])

  return (
    <PageAssistantContext.Provider value={value}>
      {children}
    </PageAssistantContext.Provider>
  )
}

export function usePageAssistantContext() {
  const ctx = useContext(PageAssistantContext)
  if (!ctx) throw new Error("usePageAssistantContext must be used inside PageAssistantProvider")
  return ctx
}

/**
 * Hook to register page data. Call inside a useEffect with relevant deps.
 * Pages call this to expose visible data to the contextual assistant.
 */
export function usePageAssistantData() {
  const { setPageData } = usePageAssistantContext()
  return setPageData
}
