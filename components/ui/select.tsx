"use client"

import * as React from "react"
import { Select as SelectPrimitive } from "@base-ui/react/select"
import { CheckIcon, ChevronDownIcon, SearchIcon } from "lucide-react"
import { cn } from "@/lib/utils"

// ── Root ──────────────────────────────────────────────────────
function Select({ ...props }: SelectPrimitive.Root.Props<string>) {
  return <SelectPrimitive.Root data-slot="select" {...props} />
}

// ── Trigger ───────────────────────────────────────────────────
function SelectTrigger({
  className,
  children,
  ...props
}: SelectPrimitive.Trigger.Props) {
  const spanRef = React.useRef<HTMLSpanElement>(null)

  React.useEffect(() => {
    if (spanRef.current) {
      spanRef.current.title = spanRef.current.textContent ?? ""
    }
  })

  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={cn(
        "flex h-9 w-full min-w-0 overflow-hidden items-center justify-between gap-2 rounded-custom border px-3 py-1 text-sm outline-none transition-colors",
        "border-border-default bg-surface-input text-text-primary",
        "placeholder:text-text-secondary",
        "focus-visible:border-brand-primary focus-visible:ring-2 focus-visible:ring-brand-primary/20",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-expanded:border-brand-primary aria-expanded:ring-2 aria-expanded:ring-brand-primary/20",
        className
      )}
      {...props}
    >
      <span ref={spanRef} className="truncate min-w-0 flex-1 text-left">{children}</span>
      <SelectPrimitive.Icon>
        <ChevronDownIcon className="size-4 shrink-0 text-text-secondary" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
}

// ── Value ─────────────────────────────────────────────────────
function SelectValue({ className, ...props }: SelectPrimitive.Value.Props) {
  return <SelectPrimitive.Value data-slot="select-value" className={cn("truncate", className)} {...props} />
}

// ── Popup ─────────────────────────────────────────────────────
function SelectPopup({
  className,
  children,
  ...props
}: SelectPrimitive.Popup.Props) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner sideOffset={4} className="z-200">
        <SelectPrimitive.Popup
          data-slot="select-popup"
          className={cn(
            "min-w-32 overflow-hidden rounded-custom border border-border-default bg-surface-card shadow-card outline-none",
            "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
            "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className
          )}
          {...props}
        >
          <SelectPrimitive.List className="p-1">{children}</SelectPrimitive.List>
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  )
}

// ── Item ──────────────────────────────────────────────────────
function SelectItem({
  className,
  children,
  ...props
}: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "relative flex cursor-pointer select-none items-center gap-2 rounded-custom py-1.5 pl-8 pr-2 text-sm text-text-primary outline-none transition-colors",
        "hover:bg-surface-default focus:bg-surface-default",
        "data-disabled:pointer-events-none data-disabled:opacity-50",
        className
      )}
      {...props}
    >
      <span className="absolute left-2 flex size-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <CheckIcon className="size-4 text-brand-primary" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
}

// ── Popup with search + scroll ────────────────────────────────
interface SelectPopupSearchableProps extends Omit<SelectPrimitive.Popup.Props, "children"> {
  searchValue: string
  onSearchChange: (value: string) => void
  searchPlaceholder?: string
  footer?: React.ReactNode
  children: React.ReactNode
}

function SelectPopupSearchable({
  className,
  searchValue,
  onSearchChange,
  searchPlaceholder = "Buscar...",
  footer,
  children,
  ...props
}: SelectPopupSearchableProps) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner sideOffset={4} className="z-200">
        <SelectPrimitive.Popup
          data-slot="select-popup"
          className={cn(
            "min-w-32 overflow-hidden rounded-custom border border-border-default bg-surface-card shadow-card outline-none",
            "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
            "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className
          )}
          {...props}
        >
          {/* Search input — outside the List so it doesn't become a select item */}
          <div className="flex items-center gap-2 border-b border-border-default px-3 py-2">
            <SearchIcon className="size-3.5 shrink-0 text-text-secondary" />
            <input
              type="text"
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-secondary outline-none"
              onKeyDown={(e) => e.stopPropagation()}
            />
          </div>
          <SelectPrimitive.List>
            {/* Scrollable items */}
            <div className="max-h-50 overflow-y-auto p-1">
              {children}
            </div>
            {/* Fixed footer — always visible, outside the scroll area */}
            {footer && (
              <div className="border-t border-border-default p-1">
                {footer}
              </div>
            )}
          </SelectPrimitive.List>
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  )
}

// ── Label ─────────────────────────────────────────────────────
function SelectLabel({
  className,
  ...props
}: SelectPrimitive.Label.Props) {
  return (
    <SelectPrimitive.Label
      data-slot="select-label"
      className={cn(
        "px-2 py-1.5 text-xs font-semibold text-text-secondary",
        className
      )}
      {...props}
    />
  )
}

// ── Group ─────────────────────────────────────────────────────
function SelectGroup({ ...props }: SelectPrimitive.Group.Props) {
  return <SelectPrimitive.Group data-slot="select-group" {...props} />
}

export {
  Select,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectPopup,
  SelectPopupSearchable,
  SelectTrigger,
  SelectValue,
}
