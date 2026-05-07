"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { INDIVIDUAL_NAV_ENTRIES } from "@/components/individual/individualNavEntries"
import { cn } from "@/lib/utils"

export interface IndividualSectionTabsPresentationProps {
  pathname: string
  /** Ex.: `?userId=U-23` ou string vazia */
  querySuffix: string
}

/** Útil em Storybook e testes (sem `usePathname`). */
export function IndividualSectionTabsPresentation({
  pathname,
  querySuffix,
}: IndividualSectionTabsPresentationProps) {
  return (
    <div className="flex w-fit max-w-full flex-wrap gap-0.5 rounded-custom border border-border-default bg-surface-card p-1 shadow-card">
      {INDIVIDUAL_NAV_ENTRIES.map(({ slug: href, label, icon: Icon }) => {
        const active = pathname === `/individual/${href}`
        return (
          <Link
            key={href}
            href={`/individual/${href}${querySuffix}`}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-150",
              active
                ? "bg-brand-primary text-white shadow-sm"
                : "text-text-secondary hover:bg-neutral-grey-100 hover:text-text-primary",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {label}
          </Link>
        )
      })}
    </div>
  )
}

interface IndividualSectionTabsProps {
  querySuffix: string
}

export function IndividualSectionTabs({ querySuffix }: IndividualSectionTabsProps) {
  const pathname = usePathname()
  return <IndividualSectionTabsPresentation pathname={pathname} querySuffix={querySuffix} />
}
