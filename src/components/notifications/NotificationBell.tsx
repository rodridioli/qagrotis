"use client"

import * as React from "react"
import { Bell } from "lucide-react"
import { cn } from "@/core/utils"
import { useNotifications } from "@/hooks/useNotifications"
import { NotificationDrawer } from "./NotificationDrawer"

export function NotificationBell() {
  const [open, setOpen] = React.useState(false)
  const [bouncing, setBouncing] = React.useState(false)
  const { data } = useNotifications()

  const count = data?.length ?? 0
  const displayCount = count > 9 ? "9+" : count > 0 ? String(count) : null

  const prevCountRef = React.useRef(0)
  React.useEffect(() => {
    if (count > prevCountRef.current) {
      setBouncing(true)
      const t = setTimeout(() => setBouncing(false), 600)
      return () => clearTimeout(t)
    }
    prevCountRef.current = count
  }, [count])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={count > 0 ? `Notificações (${count} não lida${count > 1 ? "s" : ""})` : "Notificações"}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="relative flex size-8 cursor-pointer items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-neutral-grey-100 hover:text-text-primary"
      >
        <Bell className="size-4" />
        {displayCount !== null && (
          <span
            aria-hidden="true"
            className={cn(
              "absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white transition-opacity duration-200",
              bouncing && "animate-bounce"
            )}
          >
            {displayCount}
          </span>
        )}
      </button>
      <NotificationDrawer open={open} onOpenChange={setOpen} />
    </>
  )
}
