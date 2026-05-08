"use client"

import * as React from "react"
import { MessageSquare, ClipboardCheck, TrendingUp, Trophy } from "lucide-react"
import { cn } from "@/core/utils"
import { formatNotificationTime } from "@/lib/notification-time"
import type { NotificationData, NotificationType } from "@/core/actions/notifications"

const TYPE_CONFIG: Record<NotificationType, {
  icon: React.ComponentType<{ className?: string }>
  bgClass: string
}> = {
  FEEDBACK:   { icon: MessageSquare,  bgClass: "bg-[var(--badge-info)]" },
  EVALUATION: { icon: ClipboardCheck, bgClass: "bg-brand-primary" },
  PROGRESSION:{ icon: TrendingUp,     bgClass: "bg-[var(--badge-orange)]" },
  ACHIEVEMENT:{ icon: Trophy,         bgClass: "bg-[var(--badge-warning)]" },
}

interface NotificationItemProps {
  notification: NotificationData
  onActivate: () => Promise<void>
}

export function NotificationItem({ notification, onActivate }: NotificationItemProps) {
  const [isRemoving, setIsRemoving] = React.useState(false)
  const config = TYPE_CONFIG[notification.type]
  const Icon = config.icon

  async function handleActivate() {
    if (isRemoving) return
    setIsRemoving(true)
    try {
      await onActivate()
    } catch {
      setIsRemoving(false)
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => void handleActivate()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          void handleActivate()
        }
      }}
      className={cn(
        "flex items-start gap-3 px-4 py-3 border-b border-border-default last:border-0 transition-all duration-300 cursor-pointer select-none",
        isRemoving
          ? "opacity-0 max-h-0 overflow-hidden !py-0 pointer-events-none"
          : "opacity-100 max-h-40 hover:bg-neutral-grey-50"
      )}
    >
      <div className={cn("size-9 shrink-0 rounded-full flex items-center justify-center", config.bgClass)}>
        <Icon className="size-4 text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-text-primary truncate">{notification.title}</p>
        <p className="text-xs text-text-secondary line-clamp-2">{notification.message}</p>
        <p className="text-xs text-text-secondary/60 mt-0.5">
          {formatNotificationTime(notification.createdAt)}
        </p>
      </div>
    </div>
  )
}
