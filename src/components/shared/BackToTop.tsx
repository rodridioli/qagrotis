"use client"

import { useEffect, useState } from "react"
import { ArrowUp } from "lucide-react"
import { cn } from "@/core/utils"

/**
 * Fixed back-to-top button that appears after the user scrolls down 300px
 * in the closest scrollable ancestor (the <main> layout element).
 */
export function BackToTop() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // The main scroll container in LayoutClient has overflow-auto
    const container = document.querySelector("main") ?? window as unknown as Element

    function onScroll() {
      const scrollTop =
        container === (window as unknown as Element)
          ? window.scrollY
          : (container as HTMLElement).scrollTop
      setVisible(scrollTop > 300)
    }

    const target = container === (window as unknown as Element) ? window : container
    target.addEventListener("scroll", onScroll, { passive: true })
    return () => target.removeEventListener("scroll", onScroll)
  }, [])

  function scrollToTop() {
    const container = document.querySelector("main") ?? window as unknown as Element
    if (container === (window as unknown as Element)) {
      window.scrollTo({ top: 0, behavior: "smooth" })
    } else {
      ;(container as HTMLElement).scrollTo({ top: 0, behavior: "smooth" })
    }
  }

  return (
    <button
      type="button"
      aria-label="Voltar ao topo"
      onClick={scrollToTop}
      className={cn(
        "fixed bottom-6 right-6 z-50 flex size-10 items-center justify-center rounded-full bg-brand-primary text-white shadow-lg transition-all duration-200 hover:bg-brand-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/50",
        visible ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-2 pointer-events-none"
      )}
    >
      <ArrowUp className="size-4" />
    </button>
  )
}
