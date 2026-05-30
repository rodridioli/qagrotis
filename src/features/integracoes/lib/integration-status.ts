import { getUserJiraCredentials } from "@/features/qa/lib/jira-credentials-db"
import { getClockworkApiTokenFromDb } from "@/features/qa/lib/clockwork-credentials-db"
import { env } from "@/core/env"

/** Verifica se o usuário tem credenciais Jira válidas no banco (sem chamada HTTP). */
export async function getJiraConfiguredStatus(userId: string): Promise<boolean> {
  try {
    const creds = await getUserJiraCredentials(userId)
    const url = creds?.jiraUrl?.trim() ?? ""
    const email = creds?.jiraEmail?.trim() ?? ""
    const token = creds?.apiToken?.trim() ?? ""
    return !!(url && email && token)
  } catch {
    return false
  }
}

/** Verifica se o token Clockwork está disponível (BD ou variável de ambiente). */
export async function getClockworkConfiguredStatus(): Promise<boolean> {
  try {
    const fromDb = await getClockworkApiTokenFromDb()
    if (fromDb) return true
    return !!env.CLOCKWORK_API_TOKEN.trim()
  } catch {
    return false
  }
}
