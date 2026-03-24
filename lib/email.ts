import { Resend } from "resend"
import { env } from "@/lib/env"

export const resend = new Resend(env.RESEND_API_KEY)

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string
  subject: string
  html: string
}) {
  const { data, error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to,
    subject,
    html,
  })

  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[email] Failed to send:", error)
    } else {
      console.error("[email] Failed to send email")
    }
    throw new Error("Failed to send email")
  }

  return data
}
