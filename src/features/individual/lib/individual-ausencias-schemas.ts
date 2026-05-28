import { z } from "zod"

const horaRegex = /^([01]\d|2[0-3]):([0-5]\d)$/

function horaToMinutes(hora: string): number {
  const [h, m] = hora.split(":").map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

export const createAusenciaSchema = z
  .object({
    evaluatedUserId: z.string().min(1).max(128),
    tipo: z.enum(["FALTA", "BANCO_HORAS", "ATESTADO", "ATRASO", "OUTRO"]),
    dataIso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
    diaInteiro: z.boolean(),
    horaInicio: z
      .string()
      .regex(horaRegex, "Formato inválido (HH:MM).")
      .nullable()
      .optional(),
    horaFim: z
      .string()
      .regex(horaRegex, "Formato inválido (HH:MM).")
      .nullable()
      .optional(),
    justificativa: z.string().min(1, "Este campo é obrigatório.").max(2000),
  })
  .superRefine((val, ctx) => {
    if (!val.diaInteiro) {
      if (!val.horaInicio) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Este campo é obrigatório.",
          path: ["horaInicio"],
        })
      }
      if (!val.horaFim) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Este campo é obrigatório.",
          path: ["horaFim"],
        })
      }
      if (val.horaInicio && val.horaFim) {
        if (horaToMinutes(val.horaFim) <= horaToMinutes(val.horaInicio)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Hora de término deve ser após a hora de início.",
            path: ["horaFim"],
          })
        }
      }
    }
  })

export const updateAusenciaSchema = z
  .object({
    id: z.string().min(1).max(128),
    tipo: z.enum(["FALTA", "BANCO_HORAS", "ATESTADO", "ATRASO", "OUTRO"]),
    dataIso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
    diaInteiro: z.boolean(),
    horaInicio: z
      .string()
      .regex(horaRegex, "Formato inválido (HH:MM).")
      .nullable()
      .optional(),
    horaFim: z
      .string()
      .regex(horaRegex, "Formato inválido (HH:MM).")
      .nullable()
      .optional(),
    justificativa: z.string().min(1, "Este campo é obrigatório.").max(2000),
  })
  .superRefine((val, ctx) => {
    if (!val.diaInteiro) {
      if (!val.horaInicio) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Este campo é obrigatório.",
          path: ["horaInicio"],
        })
      }
      if (!val.horaFim) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Este campo é obrigatório.",
          path: ["horaFim"],
        })
      }
      if (val.horaInicio && val.horaFim) {
        if (horaToMinutes(val.horaFim) <= horaToMinutes(val.horaInicio)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Hora de término deve ser após a hora de início.",
            path: ["horaFim"],
          })
        }
      }
    }
  })

export const refuseAusenciaSchema = z.object({
  id: z.string().min(1).max(128),
  motivoRecusa: z.string().min(1, "Este campo é obrigatório.").max(2000),
})
