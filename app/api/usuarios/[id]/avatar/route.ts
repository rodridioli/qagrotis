import { NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import { auth } from "@/lib/auth"
import { checkIsAdmin } from "@/lib/session"
import { getQaUserProfile } from "@/lib/actions/usuarios"
import { revalidatePath } from "next/cache"

const MAX_SIZE = 5 * 1024 * 1024 // 5 MB
const ALLOWED_EXTS = new Set(["jpg", "jpeg", "png", "webp", "gif"])

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
    return NextResponse.json({ error: `Arquivo muito grande. Máximo: 5 MB.` }, { status: 413 })
  }

  const ext = (photo.name.split(".").pop() ?? "").toLowerCase()
  if (!ALLOWED_EXTS.has(ext)) {
    return NextResponse.json({ error: "Formato não permitido. Use JPG, PNG, WebP ou GIF." }, { status: 415 })
  }

  try {
    const uploadDir = path.join(process.cwd(), "public", "uploads", "avatars")
    await fs.mkdir(uploadDir, { recursive: true })

    // Cleanup existing files with same ID but different extensions
    const existingFiles = await fs.readdir(uploadDir)
    const filesToDelete = existingFiles.filter(f => f.startsWith(`${id}.`))
    for (const f of filesToDelete) {
      await fs.unlink(path.join(uploadDir, f)).catch(() => {})
    }

    const buffer = Buffer.from(await photo.arrayBuffer())
    const filename = `${id}.${ext}`
    await fs.writeFile(path.join(uploadDir, filename), buffer)

    // Clear caches for user listing and profile
    revalidatePath("/configuracoes/usuarios")
    revalidatePath(`/configuracoes/usuarios/${id}`)

    return NextResponse.json({ photoPath: `/uploads/avatars/${filename}` })
  } catch (e) {
    console.error("[avatar upload] Erro ao salvar arquivo:", e)
    return NextResponse.json({ error: "Erro interno ao salvar o arquivo." }, { status: 500 })
  }
}
