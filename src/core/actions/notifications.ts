"use server"

import { z } from "zod"
import { prisma } from "@/core/prisma"
import { requireSession } from "@/core/session"
import { ensureNotificationTables } from "@/core/prisma-schema-ensure"

export type NotificationType = "FEEDBACK" | "EVALUATION" | "PROGRESSION" | "ACHIEVEMENT"

export type NotificationData = {
  id: string
  type: NotificationType
  title: string
  message: string
  link: string | null
  createdAt: string
}

const idSchema = z.string().min(1).max(128)

export async function getUnreadNotifications(): Promise<NotificationData[]> {
  try {
    const session = await requireSession()
    await ensureNotificationTables()
    const rows = await prisma.notification.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, type: true, title: true, message: true, link: true, createdAt: true },
    })
    return rows.map((r) => ({
      ...r,
      type: r.type as NotificationType,
      createdAt: r.createdAt.toISOString(),
    }))
  } catch (e) {
    console.error("[getUnreadNotifications] ERRO:", e)
    throw e
  }
}

export async function deleteNotification(id: string): Promise<{ error?: string }> {
  const parsed = idSchema.safeParse(id)
  if (!parsed.success) return { error: "ID inválido." }

  try {
    const session = await requireSession()
    await ensureNotificationTables()
    const existing = await prisma.notification.findUnique({
      where: { id: parsed.data },
      select: { userId: true },
    })
    if (!existing) return {}
    if (existing.userId !== session.user.id) return { error: "Não autorizado." }

    await prisma.notification.delete({ where: { id: parsed.data } })
    return {}
  } catch (e) {
    console.error("[deleteNotification]", e)
    return { error: "Não foi possível remover a notificação." }
  }
}

export async function deleteAllNotifications(): Promise<{ error?: string }> {
  try {
    const session = await requireSession()
    await ensureNotificationTables()
    await prisma.notification.deleteMany({ where: { userId: session.user.id } })
    return {}
  } catch (e) {
    console.error("[deleteAllNotifications]", e)
    return { error: "Não foi possível limpar as notificações." }
  }
}

const createSchema = z.object({
  userId: z.string().min(1).max(128),
  type: z.enum(["FEEDBACK", "EVALUATION", "PROGRESSION", "ACHIEVEMENT"]),
  title: z.string().min(1).max(255),
  message: z.string().min(1).max(1000),
  link: z.string().startsWith("/").max(500).nullable(),
})

export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  link: string | null,
): Promise<void> {
  const parsed = createSchema.safeParse({ userId, type, title, message, link })
  if (!parsed.success) return

  await ensureNotificationTables()
  await prisma.notification.create({
    data: {
      userId: parsed.data.userId,
      type: parsed.data.type,
      title: parsed.data.title,
      message: parsed.data.message,
      link: parsed.data.link,
    },
  })
}

/**
 * Verifica se há aniversariantes hoje e envia notificação para todos os usuários.
 * Usa deduplicação por data para não enviar mais de uma vez por dia.
 * Chamada sem requireSession pois é disparada internamente pelo layout server.
 */
export async function checkAndSendBirthdayNotifications(): Promise<void> {
  try {
    await ensureNotificationTables()

    const now = new Date()
    const month = now.getMonth() + 1
    const day = now.getDate()

    // Dedup: verifica se já enviamos aniversários hoje
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const alreadySent = await prisma.notification.findFirst({
      where: { title: "🎂 Aniversário hoje!", createdAt: { gte: todayStart } },
      select: { id: true },
    })
    if (alreadySent) return

    // Busca aniversariantes (CreatedUser)
    const allUsers = await prisma.createdUser.findMany({
      select: { id: true, name: true, dataNascimento: true },
    })

    const birthdayUsers = allUsers.filter((u) => {
      if (!u.dataNascimento) return false
      const d = new Date(u.dataNascimento)
      return d.getMonth() + 1 === month && d.getDate() === day
    })

    if (birthdayUsers.length === 0) return

    const recipientIds = allUsers.map((u) => u.id)

    for (const bday of birthdayUsers) {
      const message = `${bday.name} está fazendo aniversário hoje! 🥳 Parabenize-o(a)!`
      for (const recipientId of recipientIds) {
        await prisma.notification.create({
          data: {
            userId: recipientId,
            type: "ACHIEVEMENT",
            title: "🎂 Aniversário hoje!",
            message,
            link: null,
          },
        })
      }
    }
  } catch (e) {
    console.error("[checkAndSendBirthdayNotifications]", e)
  }
}
