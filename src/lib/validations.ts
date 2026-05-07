import { z } from "zod"

export const emailSchema = z
  .string()
  .min(1, "Email is required")
  .email("Invalid email address")
  .max(254, "Email is too long")

export const loginSchema = z.object({
  email: emailSchema,
})

export const checkoutSchema = z.object({
  // Stripe price IDs always start with "price_"
  priceId: z
    .string()
    .regex(/^price_[a-zA-Z0-9]+$/, "Invalid price ID format"),
  // returnUrl validated as a full URL; origin check is done server-side
  returnUrl: z.string().url("Invalid return URL"),
})
