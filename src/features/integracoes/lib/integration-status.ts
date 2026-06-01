import { resolveJiraCredentialsForRequest } from "@/features/qa/lib/jira-credentials-db"
import { getClockworkApiTokenFromDb } from "@/features/qa/lib/clockwork-credentials-db"

/**
 * Verifica se o usuário tem credenciais Jira válidas — checa BD com fallback
 * para cookies legados (mesmo comportamento de resolveJiraCredentialsForRequest).
 * Passa sessionEmail para que o fallback de cookies só seja aceito quando o
 * e-mail do cookie corresponde ao do utilizador autenticado.
 */
export async function getJiraConfiguredStatus(userId: string, sessionEmail?: string): Promise<boolean> {
  try {
    const creds = await resolveJiraCredentialsForRequest(userId, sessionEmail)
    return !!(creds?.jiraUrl && creds?.jiraEmail && creds?.apiToken)
  } catch {
    return false
  }
}

/** Verifica se o token Clockwork está disponível (BD ou variável de ambiente). */
export async function getClockworkConfiguredStatus(): Promise<boolean> {
  try {
    const fromDb = await getClockworkApiTokenFromDb()
    if (fromDb) return true
    return !!(process.env.CLOCKWORK_API_TOKEN?.trim())
  } catch {
    return false
  }
}
