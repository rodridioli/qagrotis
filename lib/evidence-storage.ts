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
      req.onerror = () => reject(req.error ?? new Error("Falha ao abrir IndexedDB."))
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
      }
      req.onsuccess = () => resolve(req.result)
    })
  }
  return dbPromise
}

export function shouldEvidenceUseIndexedDB(file: File): boolean {
  const t = (file.type || "").toLowerCase()
  if (t.startsWith("video/")) return true
  return file.size >= MAX_INLINE_BYTES
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error ?? new Error("Leitura do ficheiro falhou."))
    reader.readAsDataURL(file)
  })
}

export async function persistEvidenceFile(file: File): Promise<EvFile> {
  const type = file.type || "application/octet-stream"
  if (shouldEvidenceUseIndexedDB(file)) {
    const id = crypto.randomUUID()
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite")
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error("Falha ao gravar evidência."))
      tx.onabort = () => reject(tx.error ?? new Error("Gravação abortada."))
      tx.objectStore(STORE).put(file, id)
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
      req.onerror = () => reject(req.error ?? new Error("Leitura IndexedDB falhou."))
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
      tx.onerror = () => reject(tx.error ?? new Error("Falha ao gravar evidência."))
      tx.onabort = () => reject(tx.error ?? new Error("Gravação abortada."))
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
