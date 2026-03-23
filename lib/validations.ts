import { z } from "zod"

export const emailSchema = z
  .string()
  .min(1, "Email is required")
  .email("Invalid email address")

export const loginSchema = z.object({
  email: emailSchema,
})

export const checkoutSchema = z.object({
  priceId: z.string().min(1),
  returnUrl: z.string().url(),
})
