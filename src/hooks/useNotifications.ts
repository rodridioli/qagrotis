import { useQuery } from "@tanstack/react-query"
import { useSession } from "next-auth/react"
import { getUnreadNotifications } from "@/core/actions/notifications"

export { type NotificationData } from "@/core/actions/notifications"

export function useNotifications() {
  const { data: session } = useSession()

  return useQuery({
    queryKey: ["notifications", session?.user?.id],
    queryFn: () => getUnreadNotifications(),
    enabled: !!session?.user?.id,
    refetchInterval: 30_000,
    refetchOnMount: true,
  })
}
