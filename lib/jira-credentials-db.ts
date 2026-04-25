import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"
import { encryptField, decryptField } from "@/lib/db-utils"

export type StoredJiraCredentials = {
  jiraUrl: string
  jiraEmail: string
  apiToken: string
}

/** Cookies httpOnly antigos — usados como fallback se a migração ainda não rodou no Postgres. */
export async function readLegacyJiraCookies(): Promise<StoredJiraCredentials | null> {
  try {
    const c = await cookies()
    const jiraUrl = c.get("jira_url")?.value?.trim() ?? ""
    const jiraEmail = c.get("jira_email")?.value?.trim() ?? ""
    const apiToken = c.get("jira_token")?.value?.trim() ?? ""
    if (!jiraUrl || !jiraEmail || !apiToken) return null
    return { jiraUrl, jiraEmail, apiToken }
  } catch {
    return null
  }
}

export async function getUserJiraCredentials(userId: string): Promise<StoredJiraCredentials | null> {
  try {
    const row = await prisma.userJiraCredentials.findUnique({
      where: { userId },
      select: { jiraUrl: true, jiraEmail: true, apiToken: true },
    })
    if (!row) return null
    return {
      jiraUrl:   row.jiraUrl,
      jiraEmail: row.jiraEmail,
      apiToken:  decryptField(row.apiToken),
    }
  } catch (e) {
    if (process.env.NODE_ENV !== "production") console.error("[jira-credentials-db] getUserJiraCredentials:", e)
    return null
  }
}

/**
 * Salva URL/e-mail; token só é alterado quando `apiToken` vier não vazio.
 * Falha se a tabela não existir — o caller pode fazer fallback para cookies.
 */
export async function upsertUserJiraCredentials(
  userId: string,
  data: { jiraUrl: string; jiraEmail: string; apiToken?: string | null },
): Promise<void> {
  const jiraUrl = data.jiraUrl.trim()
  const jiraEmail = data.jiraEmail.trim()
  const incomingToken = data.apiToken?.trim() ?? ""
  const existing = await prisma.userJiraCredentials.findUnique({
    where: { userId },
    select: { apiToken: true },
  })
  if (!incomingToken && !existing?.apiToken) {
    throw new Error("MISSING_TOKEN")
  }
  const apiToken = incomingToken || existing!.apiToken

  await prisma.userJiraCredentials.upsert({
    where: { userId },
    create: { userId, jiraUrl, jiraEmail, apiToken: encryptField(apiToken) },
    update: {
      jiraUrl,
      jiraEmail,
      ...(incomingToken ? { apiToken: encryptField(incomingToken) } : {}),
    },
  })
}

export async function deleteUserJiraCredentials(userId: string): Promise<void> {
  try {
    await prisma.userJiraCredentials.deleteMany({ where: { userId } })
  } catch (e) {
    if (process.env.NODE_ENV !== "production") console.error("[jira-credentials-db] deleteUserJiraCredentials:", e)
  }
}

/** Mescla corpo da requisição com BD e, se preciso, cookies legados. */
export async function resolveJiraCredentialsForRequest(
  userId: string,
  partial: { jiraUrl?: string; email?: string; apiToken?: string },
): Promise<StoredJiraCredentials | null> {
  const [stored, legacy] = await Promise.all([
    getUserJiraCredentials(userId),
    readLegacyJiraCookies(),
  ])
  const jiraUrl = partial.jiraUrl?.trim() || stored?.jiraUrl || legacy?.jiraUrl || ""
  const jiraEmail = partial.email?.trim() || stored?.jiraEmail || legacy?.jiraEmail || ""
  const apiToken = partial.apiToken?.trim() || stored?.apiToken || legacy?.apiToken || ""
  if (!jiraUrl || !jiraEmail || !apiToken) return null
  return { jiraUrl, jiraEmail, apiToken }
}
