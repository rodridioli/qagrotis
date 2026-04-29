"use client"

import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { cn } from "@/lib/utils"

export interface BreadcrumbItem {
  label: React.ReactNode
  href?: string
}

interface PageBreadcrumbProps {
  /** First item is rendered next to the back button. The last item is shown as the current (bold) page. */
  items: BreadcrumbItem[]
  /** Destination of the back arrow. Defaults to the first item's href. */
  backHref?: string
  className?: string
}

export function PageBreadcrumb({ items, backHref, className }: PageBreadcrumbProps) {
  if (items.length === 0) return null
  const target = backHref ?? items[0].href ?? "/"

  return (
    <div className={cn("flex items-center gap-1.5 text-sm", className)}>
      <Link
        href={target}
        title="Voltar"
        aria-label="Voltar"
        className="flex size-8 items-center justify-center rounded-xs text-text-secondary transition-colors hover:bg-neutral-grey-100 hover:text-brand-primary"
      >
        <ArrowLeft className="size-4" />
      </Link>
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1
        return (
          <span key={idx} className="flex items-center gap-1.5">
            {isLast || !item.href ? (
              <span className={isLast ? "font-medium text-text-primary" : "text-text-secondary"}>
                {item.label}
              </span>
            ) : (
              <Link href={item.href} className="text-text-secondary hover:text-brand-primary">
                {item.label}
              </Link>
            )}
            {!isLast && <span className="text-text-secondary">/</span>}
          </span>
        )
      })}
    </div>
  )
}
