'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertCircle } from 'lucide-react'
import { getAppErrorUserMessage, logClientSegmentError } from '@/lib/app-error-message'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    logClientSegmentError('dashboard', error)
  }, [error])

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
        <AlertCircle className="size-6 text-destructive" />
      </div>
      <div className="space-y-1 max-w-md">
        <h2 className="text-base font-semibold text-text-primary">
          Algo deu errado
        </h2>
        <p className="text-sm text-text-secondary">
          {getAppErrorUserMessage(error)}
        </p>
        {error.digest && (
          <p className="font-mono text-xs text-text-secondary/60">ref: {error.digest}</p>
        )}
      </div>
      <Button variant="outline" onClick={() => reset()}>
        Tentar novamente
      </Button>
    </div>
  )
}
