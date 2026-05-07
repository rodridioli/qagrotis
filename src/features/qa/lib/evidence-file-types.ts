/**
 * Filtro do `<input type="file">` para evidências guardadas em sessão (data URL local).
 * Na exportação para o Jira os ficheiros são enviados como anexos.
 */
export const EVIDENCE_FILE_ACCEPT =
  "image/*,application/pdf,video/*,.pdf,.mp4,.webm,.mov,.mkv,.m4v,.avi,.mpeg,.mpg,.ogv"

export function isAllowedEvidenceFile(file: Pick<File, "name" | "type">): boolean {
  const t = (file.type || "").toLowerCase()
  if (t.startsWith("image/")) return true
  if (t === "application/pdf") return true
  if (t.startsWith("video/")) return true
  const n = file.name.toLowerCase()
  if (n.endsWith(".pdf")) return true
  return /\.(mp4|m4v|webm|mov|mkv|ogv|avi|mpeg|mpg)$/i.test(file.name)
}

export function filterAllowedEvidenceFiles(files: File[]): {
  allowed: File[]
  rejectedNames: string[]
} {
  const allowed: File[] = []
  const rejectedNames: string[] = []
  for (const f of files) {
    if (isAllowedEvidenceFile(f)) allowed.push(f)
    else rejectedNames.push(f.name)
  }
  return { allowed, rejectedNames }
}
