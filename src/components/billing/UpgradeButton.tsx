"use client"

import { Button } from "@/components/ui/button"
import { useCheckout } from "@/hooks/useSubscription"

interface UpgradeButtonProps {
  /** Stripe Price ID — passed from server component to avoid exposing via NEXT_PUBLIC */
  priceId: string
  returnPath?: string
}

export function UpgradeButton({
  priceId,
  returnPath = "/dashboard",
}: UpgradeButtonProps) {
  const checkout = useCheckout()

  const handleUpgrade = () => {
    const returnUrl = `${window.location.origin}${returnPath}`
    checkout.mutate({ priceId, returnUrl })
  }

  return (
    <Button onClick={handleUpgrade} disabled={checkout.isPending}>
      {checkout.isPending ? "Redirecting..." : "Upgrade to Pro"}
    </Button>
  )
}
