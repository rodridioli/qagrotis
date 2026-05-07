"use client"

import * as React from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** Botão secundário de cancelamento: ícone X à esquerda do rótulo. */
export function CancelActionButton({
  className,
  children = "Cancelar",
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button type="button" variant="outline" className={cn("gap-1.5", className)} {...props}>
      <X className="size-4 shrink-0" />
      {children}
    </Button>
  )
}
