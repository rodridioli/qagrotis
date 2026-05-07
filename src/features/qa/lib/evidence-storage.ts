/**
 * Evidências de execução: vídeos e ficheiros grandes não entram em base64 no `sessionStorage`
 * (evita OOM no separador). Metadados + chave IDB ficam no JSON da sessão.
 */
export type EvFile = {
  name: string
  type: string
  dataUrl?: string
  idbKey?: string
}

const DB_NAME = "qagrotis-evidence"
const STORE = "files"
const MAX_INLINE_BYTES = 3 * 1024 * 1024
/** Extensões de vídeo: alguns browsers deixam `file.type` vazio para .mp4 — ainda assim deve ir para IDB. */
const VIDEO_NAME_EXT = /\.(mp4|m4v|webm|mov|mkv|ogv|avi|mpeg|mpg|3gp)$/i
/** Base64 em `sessionStorage` enche a quota (~5 MB); acima disto migra-se para IDB. */
const MAX_DATA_URL_CHARS_IN_SESSION = 48_000

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB indisponível."))
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1)
      req.onerror = () => reject(new Error(formatEvidenceError(req.error)))
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
      }
      req.onsuccess = () => resolve(req.result)
    })
  }
  return dbPromise
}

/** Mensagem legível para toasts: `DOMException` do IndexedDB costuma ter `message` vazio. */
export function formatEvidenceError(err: unknown): string {
  if (typeof err === "string" && err.trim()) return err.trim()
  if (err instanceof Error) {
    const m = err.message?.trim()
    if (m) return m
  }
  const e = err as { message?: string; name?: string } | null
  if (e && typeof e === "object") {
    const name = typeof e.name === "string" ? e.name : ""
    if (name === "QuotaExceededError") {
      return "Armazenamento local cheio. Liberte espaço, reduza o tamanho do vídeo ou remova anexos antigos."
    }
    const m = typeof e.message === "string" ? e.message.trim() : ""
    if (m) return m
    if (name) return `Erro do navegador (${name}). Tente anexar de novo ou noutro browser.`
  }
  return "Não foi possível gravar a evidência. Tente novamente ou confirme espaço em disco."
}

function effectiveEvidenceMime(file: File): string {
  const t = (file.type || "").trim()
  if (t) return t
  const n = file.name.toLowerCase()
  if (n.endsWith(".mp4") || n.endsWith(".m4v")) return "video/mp4"
  if (n.endsWith(".webm")) return "video/webm"
  if (n.endsWith(".mov")) return "video/quicktime"
  if (n.endsWith(".mkv")) return "video/x-matroska"
  if (n.endsWith(".ogv") || n.endsWith(".ogg")) return "video/ogg"
  if (n.endsWith(".avi")) return "video/x-msvideo"
  if (n.endsWith(".mpeg") || n.endsWith(".mpg")) return "video/mpeg"
  if (n.endsWith(".3gp")) return "video/3gpp"
  if (n.endsWith(".pdf")) return "application/pdf"
  if (n.endsWith(".png")) return "image/png"
  if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg"
  if (n.endsWith(".gif")) return "image/gif"
  if (n.endsWith(".webp")) return "image/webp"
  return "application/octet-stream"
}

export function shouldEvidenceUseIndexedDB(file: File): boolean {
  const t = (file.type || "").toLowerCase()
  if (t.startsWith("video/")) return true
  if (VIDEO_NAME_EXT.test(file.name)) return true
  return file.size >= MAX_INLINE_BYTES
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error(formatEvidenceError(reader.error)))
    reader.readAsDataURL(file)
  })
}

export async function persistEvidenceFile(file: File): Promise<EvFile> {
  const type = effectiveEvidenceMime(file)
  if (shouldEvidenceUseIndexedDB(file)) {
    const id = crypto.randomUUID()
    const db = await openDb()
    const blob = new Blob([file], { type })
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite")
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(new Error(formatEvidenceError(tx.error)))
      tx.onabort = () => reject(new Error(formatEvidenceError(tx.error)))
      tx.objectStore(STORE).put(blob, id)
    })
    return { name: file.name, type, idbKey: id }
  }
  const dataUrl = await readFileAsDataURL(file)
  return { name: file.name, type, dataUrl }
}

export async function evidenceFileToBlob(ev: Pick<EvFile, "dataUrl" | "idbKey">): Promise<Blob> {
  if (ev.idbKey) {
    const db = await openDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly")
      const req = tx.objectStore(STORE).get(ev.idbKey as string)
      req.onsuccess = () => {
        const v = req.result as File | Blob | undefined
        if (!v) {
          reject(new Error("Evidência não encontrada. Volte a anexar o ficheiro."))
          return
        }
        resolve(v)
      }
      req.onerror = () => reject(new Error(formatEvidenceError(req.error)))
    })
  }
  if (ev.dataUrl) return fetch(ev.dataUrl).then((r) => r.blob())
  throw new Error("Evidência inválida.")
}

/**
 * Garante JSON pequeno para `sessionStorage`: mantém idbKey; dataUrl grande vira novo blob em IDB.
 */
export async function prepareEvidenceForSessionSnapshot(evs: EvFile[]): Promise<EvFile[]> {
  const out: EvFile[] = []
  for (const ev of evs) {
    if (ev.idbKey) {
      out.push({ name: ev.name, type: ev.type, idbKey: ev.idbKey })
      continue
    }
    const du = ev.dataUrl
    if (!du) {
      out.push({ name: ev.name, type: ev.type })
      continue
    }
    if (du.length <= MAX_DATA_URL_CHARS_IN_SESSION) {
      out.push({ name: ev.name, type: ev.type, dataUrl: du })
      continue
    }
    const blob = await fetch(du).then((r) => r.blob())
    const id = crypto.randomUUID()
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite")
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(new Error(formatEvidenceError(tx.error)))
      tx.onabort = () => reject(new Error(formatEvidenceError(tx.error)))
      tx.objectStore(STORE).put(blob, id)
    })
    out.push({ name: ev.name, type: ev.type, idbKey: id })
  }
  return out
}

export async function deleteEvidenceFile(ev: Pick<EvFile, "idbKey">): Promise<void> {
  if (!ev.idbKey) return
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite")
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.objectStore(STORE).delete(ev.idbKey as string)
    })
  } catch {
    /* ignore */
  }
}
