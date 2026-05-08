"use client"

import * as React from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { BellOff, WifiOff, X } from "lucide-react"
import { toast } from "sonner"
import {
  Sheet,
  SheetContent,
  SheetClose,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { useNotifications } from "@/hooks/useNotifications"
import { NotificationItem } from "./NotificationItem"
import {
  deleteNotification,
  deleteAllNotifications,
  type NotificationData,
} from "@/core/actions/notifications"

interface NotificationDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function NotificationSkeletons() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="flex items-start gap-3 px-4 py-3 border-b border-border-default last:border-0"
        >
          <div className="size-9 rounded-full bg-neutral-grey-100 animate-pulse shrink-0" />
          <div className="flex-1 space-y-2 pt-0.5">
            <div className="h-3 w-3/4 rounded bg-neutral-grey-100 animate-pulse" />
            <div className="h-3 w-full rounded bg-neutral-grey-100 animate-pulse" />
            <div className="h-3 w-1/4 rounded bg-neutral-grey-100 animate-pulse" />
          </div>
        </div>
      ))}
    </>
  )
}

export function NotificationDrawer({ open, onOpenChange }: NotificationDrawerProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data, isLoading, isError, refetch } = useNotifications()
  const notifications = data ?? []

  async function handleDeleteOne(notification: NotificationData) {
    const result = await deleteNotification(notification.id)
    if (result?.error) {
      toast.error("Não foi possível remover a notificação.")
      throw new Error(result.error)
    }
    await queryClient.invalidateQueries({ queryKey: ["notifications"] })
    onOpenChange(false)
    if (notification.link) router.push(notification.link)
  }

  async function handleDeleteAll() {
    const result = await deleteAllNotifications()
    if (result?.error) {
      toast.error("Não foi possível limpar as notificações.")
      return
    }
    await queryClient.invalidateQueries({ queryKey: ["notifications"] })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-full sm:max-w-sm p-0 flex flex-col"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-default shrink-0">
          <SheetTitle className="text-base font-semibold text-text-primary">
            Notificações
          </SheetTitle>
          <div className="flex items-center gap-1">
            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void handleDeleteAll()}
                className="h-7 px-2 text-xs text-text-secondary"
              >
                Limpar tudo
              </Button>
            )}
            <SheetClose
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Fechar notificações"
                />
              }
            >
              <X className="size-4" />
            </SheetClose>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading && <NotificationSkeletons />}

          {isError && !isLoading && (
            <div className="flex flex-col items-center justify-center gap-3 px-4 py-12 text-center">
              <WifiOff className="size-8 text-text-secondary/30" />
              <p className="text-sm text-text-secondary">
                Não foi possível carregar as notificações.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void refetch()}
              >
                Tentar novamente
              </Button>
            </div>
          )}

          {!isLoading && !isError && notifications.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 px-4 py-12 text-center">
              <BellOff className="size-10 text-text-secondary/30" />
              <p className="text-sm text-text-secondary">
                Nenhuma notificação por aqui.
              </p>
            </div>
          )}

          {!isLoading && !isError && notifications.length > 0 && (
            <div aria-live="polite" aria-label="Lista de notificações">
              {notifications.map((n) => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  onActivate={() => handleDeleteOne(n)}
                />
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
