"use client"

import { useEffect } from "react"
import { useSession } from "next-auth/react"

const LS_COOKIE_OK = "jira_cookie_ok"

/**
 * Reforça URL/e-mail no localStorage a partir dos cookies httpOnly e marca que o token
 * existe no servidor. Assim o Gerador e outros fluxos não exigem `jira_token` no storage
 * após limpeza parcial do navegador — o `/api/jira` continua usando o cookie.
 */
export function JiraCredentialsSync() {
  const { status } = useSession()

  useEffect(() => {
    if (status !== "authenticated") return
    let cancelled = false

    fetch("/api/jira/credentials", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { configured?: boolean; jiraUrl?: string; jiraEmail?: string } | null) => {
        if (cancelled || !d?.configured) return
        try {
          if (d.jiraUrl) localStorage.setItem("jira_url", d.jiraUrl)
          if (d.jiraEmail) localStorage.setItem("jira_email", d.jiraEmail)
          localStorage.setItem(LS_COOKIE_OK, "1")
          window.dispatchEvent(new Event("jira-credentials-synced"))
        } catch {
          /* storage indisponível */
        }
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [status])

  return null
}
