import { prisma } from "@/lib/prisma"

export type StoredJiraCredentials = {
  jiraUrl: string
  jiraEmail: string
  apiToken: string
}

export async function getUserJiraCredentials(userId: string): Promise<StoredJiraCredentials | null> {
  const row = await prisma.userJiraCredentials.findUnique({
    where: { userId },
    select: { jiraUrl: true, jiraEmail: true, apiToken: true },
  })
  if (!row) return null
  return { jiraUrl: row.jiraUrl, jiraEmail: row.jiraEmail, apiToken: row.apiToken }
}

/**
 * Salva URL/e-mail; token só é alterado quando `apiToken` vier não vazio.
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
    create: { userId, jiraUrl, jiraEmail, apiToken },
    update: {
      jiraUrl,
      jiraEmail,
      ...(incomingToken ? { apiToken: incomingToken } : {}),
    },
  })
}

export async function deleteUserJiraCredentials(userId: string): Promise<void> {
  await prisma.userJiraCredentials.deleteMany({ where: { userId } })
}

/** Mescla corpo da requisição com credenciais persistidas (prioriza corpo quando completo). */
export async function resolveJiraCredentialsForRequest(
  userId: string,
  partial: { jiraUrl?: string; email?: string; apiToken?: string },
): Promise<StoredJiraCredentials | null> {
  const stored = await getUserJiraCredentials(userId)
  const jiraUrl = partial.jiraUrl?.trim() || stored?.jiraUrl || ""
  const jiraEmail = partial.email?.trim() || stored?.jiraEmail || ""
  const apiToken = partial.apiToken?.trim() || stored?.apiToken || ""
  if (!jiraUrl || !jiraEmail || !apiToken) return null
  return { jiraUrl, jiraEmail, apiToken }
}
