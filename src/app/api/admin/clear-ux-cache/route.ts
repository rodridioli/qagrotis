import { NextResponse } from "next/server"
import { auth } from "@/core/auth"
import { prisma } from "@/core/prisma"
import { buildRole } from "@/core/rbac/policy"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const role = buildRole(session.user.type, session.user.accessProfile)
  if (role !== "Administrador:MGR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { year, months } = (await req.json()) as { year: number; months: number[] }

  const deleted = await prisma.jiraWorklogCache.deleteMany({
    where: { year, month: { in: months } },
  })
  const markers = await prisma.jiraWorklogSyncMarker.deleteMany({
    where: { year, month: { in: months } },
  })

  return NextResponse.json({
    ok: true,
    deletedCache: deleted.count,
    deletedMarkers: markers.count,
  })
}
