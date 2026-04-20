"use client"

import { useEffect } from "react"
import { AlertTriangle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getAppErrorUserMessage, logClientSegmentError } from "@/lib/app-error-message"

export default function ProtectedError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    logClientSegmentError("protected-layout", error)
  }, [error])

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="size-7 text-destructive" />
      </div>
      <div className="max-w-sm space-y-1">
        <p className="text-base font-semibold text-text-primary">Algo deu errado</p>
        <p className="text-sm text-text-secondary">{getAppErrorUserMessage(error)}</p>
        {error.digest && (
          <p className="font-mono text-xs text-text-secondary/60">ref: {error.digest}</p>
        )}
      </div>
      <Button variant="outline" onClick={() => reset()} className="gap-2">
        <RefreshCw className="size-4" />
        Tentar novamente
      </Button>
    </div>
  )
}
