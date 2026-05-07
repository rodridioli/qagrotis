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

/**
 * Resolve credenciais a partir do BD do usuário (com fallback para cookies legados).
 * NÃO confia no body/form da requisição: dados controlados pelo cliente são ignorados
 * para impedir SSRF lateral via `jiraUrl`.
 */
export async function resolveJiraCredentialsForRequest(
  userId: string,
  _partial?: { jiraUrl?: string; email?: string; apiToken?: string },
): Promise<StoredJiraCredentials | null> {
  void _partial
  const [stored, legacy] = await Promise.all([
    getUserJiraCredentials(userId),
    readLegacyJiraCookies(),
  ])
  const jiraUrl = stored?.jiraUrl || legacy?.jiraUrl || ""
  const jiraEmail = stored?.jiraEmail || legacy?.jiraEmail || ""
  const apiToken = stored?.apiToken || legacy?.apiToken || ""
  if (!jiraUrl || !jiraEmail || !apiToken) return null
  if (!isAllowedJiraUrl(jiraUrl)) return null
  return { jiraUrl, jiraEmail, apiToken }
}

/** Valida que a URL do Jira é HTTPS e não aponta para hosts internos/privados. */
export function isAllowedJiraUrl(url: string): boolean {
  let u: URL
  try { u = new URL(url) } catch { return false }
  if (u.protocol !== "https:") return false
  const host = u.hostname.toLowerCase()
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") return false
  if (/^10\./.test(host)) return false
  if (/^192\.168\./.test(host)) return false
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false
  if (/^169\.254\./.test(host)) return false
  return true
}

/** Verifica que `targetUrl` está no mesmo host (ou subdomínio Atlassian) da URL Jira armazenada. */
export function isSameJiraHost(storedUrl: string, targetUrl: string): boolean {
  let stored: URL, target: URL
  try { stored = new URL(storedUrl); target = new URL(targetUrl) } catch { return false }
  if (target.protocol !== "https:") return false
  if (target.hostname.toLowerCase() === stored.hostname.toLowerCase()) return true
  // Anexos Atlassian Cloud podem residir em *.atlassian.net e api.media.atlassian.com
  const allowed = ["atlassian.net", "atlassian.com", "media.atlassian.com"]
  return allowed.some((d) => target.hostname.toLowerCase().endsWith(`.${d}`) || target.hostname.toLowerCase() === d)
}
