import { useSession } from "next-auth/react"
import { useQuery, useMutation } from "@tanstack/react-query"

/**
 * Hook to get current user's subscription status.
 * Fetches fresh data from the API.
 */
export function useSubscription() {
  const { data: session } = useSession()

  return useQuery({
    queryKey: ["subscription", session?.user?.id],
    queryFn: async () => {
      const res = await fetch("/api/user/subscription")
      if (!res.ok) throw new Error("Failed to fetch subscription")
      return res.json() as Promise<{
        plan: string
        hasAccess: boolean
        trialDaysLeft: number
        isSubscribed: boolean
      }>
    },
    enabled: !!session?.user?.id,
  })
}

/**
 * Hook to redirect user to Stripe Checkout.
 */
export function useCheckout() {
  return useMutation({
    mutationFn: async ({
      priceId,
      returnUrl,
    }: {
      priceId: string
      returnUrl: string
    }) => {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId, returnUrl }),
      })

      if (!res.ok) throw new Error("Failed to create checkout session")
      const { url } = await res.json()
      window.location.href = url
    },
  })
}

/**
 * Hook to redirect user to Stripe Customer Portal.
 */
export function useCustomerPortal() {
  return useMutation({
    mutationFn: async ({ returnUrl }: { returnUrl: string }) => {
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnUrl }),
      })

      if (!res.ok) throw new Error("Failed to create portal session")
      const { url } = await res.json()
      window.location.href = url
    },
  })
}
