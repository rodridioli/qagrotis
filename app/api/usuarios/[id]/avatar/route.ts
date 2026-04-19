import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { checkIsAdmin } from "@/lib/session"
import { getQaUserProfile } from "@/lib/actions/usuarios"
import { revalidatePath } from "next/cache"

const MAX_SIZE = 5 * 1024 * 1024 // 5 MB
const ALLOWED_TYPES: Record<string, string> = {
  jpg:  "image/jpeg",
  jpeg: "image/jpeg",
  png:  "image/png",
  webp: "image/webp",
  gif:  "image/gif",
}

// Magic byte signatures — validated against actual file content, not filename
const MAGIC_SIGNATURES: Array<{ mime: string; bytes: number[]; offset?: number }> = [
  { mime: "image/jpeg", bytes: [0xFF, 0xD8, 0xFF] },
  { mime: "image/png",  bytes: [0x89, 0x50, 0x4E, 0x47] },
  { mime: "image/gif",  bytes: [0x47, 0x49, 0x46] },
  { mime: "image/webp", bytes: [0x57, 0x45, 0x42, 0x50], offset: 8 },
]

function detectMimeFromBytes(buf: Buffer): string | null {
  for (const sig of MAGIC_SIGNATURES) {
    const offset = sig.offset ?? 0
    if (buf.length < offset + sig.bytes.length) continue
    if (sig.bytes.every((b, i) => buf[offset + i] === b)) return sig.mime
  }
  return null
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const { id } = await params

  // Sanitize id to prevent path traversal — allow only alphanumeric + dash/underscore
  if (!/^[A-Za-z0-9_-]+$/.test(id)) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 })
  }

  // Only admins can upload for other users; regular users can only update their own avatar
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) {
    const targetProfile = await getQaUserProfile(id)
    const sessionEmail = session.user.email?.toLowerCase() ?? ""
    if (!targetProfile || targetProfile.email.toLowerCase() !== sessionEmail) {
      return NextResponse.json({ error: "Não autorizado para esta ação." }, { status: 403 })
    }
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch (e) {
    console.error("[avatar upload] Erro ao processar formData:", e)
    return NextResponse.json({ error: "Erro ao processar o arquivo enviado." }, { status: 400 })
  }

  const photo = formData.get("photo") as File | null

  if (!photo || photo.size === 0) {
    return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 })
  }

  if (photo.size > MAX_SIZE) {
    return NextResponse.json({ error: "Arquivo muito grande. Máximo: 5 MB." }, { status: 413 })
  }

  const ext = (photo.name.split(".").pop() ?? "").toLowerCase()
  if (!ALLOWED_TYPES[ext]) {
    return NextResponse.json({ error: "Formato não permitido. Use JPG, PNG, WebP ou GIF." }, { status: 415 })
  }

  try {
    const buffer = Buffer.from(await photo.arrayBuffer())

    // Validate actual file content via magic bytes — prevents disguised uploads
    const detectedMime = detectMimeFromBytes(buffer)
    if (!detectedMime || !Object.values(ALLOWED_TYPES).includes(detectedMime)) {
      return NextResponse.json({ error: "Conteúdo do arquivo não corresponde ao formato declarado." }, { status: 415 })
    }
    const mimeType = detectedMime

    const base64 = buffer.toString("base64")
    const photoPath = `data:${mimeType};base64,${base64}`

    revalidatePath("/configuracoes/usuarios")
    revalidatePath(`/configuracoes/usuarios/${id}`)
    revalidatePath(`/configuracoes/usuarios/${id}/editar`)

    return NextResponse.json({ photoPath })
  } catch (e) {
    console.error("[avatar upload] Erro ao processar imagem:", e)
    return NextResponse.json({ error: "Erro interno ao salvar o arquivo." }, { status: 500 })
  }
}
