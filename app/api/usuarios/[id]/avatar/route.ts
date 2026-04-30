import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { checkIsAdmin } from "@/lib/session"
import { getQaUserProfile } from "@/lib/actions/usuarios"
import { revalidatePath } from "next/cache"

const MAX_AVATAR_BYTES = 6 * 1024 * 1024

function parseDataImageResponse(dataUrl: string): { contentType: string; body: Buffer } | null {
  if (!dataUrl.startsWith("data:")) return null
  const comma = dataUrl.indexOf(",")
  if (comma < 0) return null
  const meta = dataUrl.slice(5, comma).trim()
  const m = /^image\/(jpeg|png|gif|webp);base64$/i.exec(meta)
  if (!m) return null
  const payload = dataUrl.slice(comma + 1)
  try {
    const body = Buffer.from(payload, "base64")
    if (body.length === 0 || body.length > MAX_AVATAR_BYTES) return null
    const ext = m[1].toLowerCase()
    return { contentType: `image/${ext}`, body }
  } catch {
    return null
  }
}

/** Avatar para `<img>`: data URLs não vão no JWT (cookie); o cliente usa esta rota. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return new NextResponse(null, { status: 401 })
  }

  const { id } = await params
  if (!/^[A-Za-z0-9_-]+$/.test(id)) {
    return new NextResponse(null, { status: 400 })
  }

  const isSelf = session.user.id === id
  const isAdmin = await checkIsAdmin()
  if (!isSelf && !isAdmin) {
    return new NextResponse(null, { status: 403 })
  }

  const profile = await getQaUserProfile(id)
  const photo = profile?.photoPath?.trim()
  if (!photo) {
    return new NextResponse(null, { status: 404 })
  }

  if (photo.startsWith("https://") || photo.startsWith("http://")) {
    return NextResponse.redirect(photo)
  }

  const parsed = parseDataImageResponse(photo)
  if (parsed) {
    const body = new Uint8Array(parsed.body)
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": parsed.contentType,
        "Cache-Control": "private, max-age=300",
      },
    })
  }

  return new NextResponse(null, { status: 404 })
}

const MAX_SIZE = 5 * 1024 * 1024 // 5 MB
const ALLOWED_TYPES: Record<string, string> = {
  jpg:  "image/jpeg",
  jpeg: "image/jpeg",
  png:  "image/png",
  webp: "image/webp",
  gif:  "image/gif",
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
  const mimeType = ALLOWED_TYPES[ext]
  if (!mimeType) {
    return NextResponse.json({ error: "Formato não permitido. Use JPG, PNG, WebP ou GIF." }, { status: 415 })
  }

  try {
    const buffer = Buffer.from(await photo.arrayBuffer())
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
