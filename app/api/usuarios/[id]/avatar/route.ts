import { NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const formData = await request.formData()
  const photo = formData.get("photo") as File | null

  if (!photo || photo.size === 0) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 })
  }

  const ext = (photo.name.split(".").pop() ?? "jpg").toLowerCase()
  const uploadDir = path.join(process.cwd(), "public", "uploads", "avatars")
  await fs.mkdir(uploadDir, { recursive: true })

  const buffer = Buffer.from(await photo.arrayBuffer())
  await fs.writeFile(path.join(uploadDir, `${id}.${ext}`), buffer)

  return NextResponse.json({ photoPath: `/uploads/avatars/${id}.${ext}` })
}
