import { z } from "zod"

export const createAusenciaSchema = z
  .object({
    evaluatedUserId: z.string().min(1).max(128),
    tipo: z.enum(["FALTA", "BANCO_HORAS", "ATESTADO", "ATRASO", "OUTRO"]),
    dataInicioIso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
    dataFimIso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
    justificativa: z.string().min(1, "Este campo é obrigatório.").max(2000),
  })
  .superRefine((val, ctx) => {
    if (val.dataInicioIso && val.dataFimIso && val.dataFimIso < val.dataInicioIso) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A data de término deve ser igual ou posterior à data de início.",
        path: ["dataFimIso"],
      })
    }
  })

export const updateAusenciaSchema = z
  .object({
    id: z.string().min(1).max(128),
    tipo: z.enum(["FALTA", "BANCO_HORAS", "ATESTADO", "ATRASO", "OUTRO"]),
    dataInicioIso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
    dataFimIso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
    justificativa: z.string().min(1, "Este campo é obrigatório.").max(2000),
  })
  .superRefine((val, ctx) => {
    if (val.dataInicioIso && val.dataFimIso && val.dataFimIso < val.dataInicioIso) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A data de término deve ser igual ou posterior à data de início.",
        path: ["dataFimIso"],
      })
    }
  })

export const refuseAusenciaSchema = z.object({
  id: z.string().min(1).max(128),
  motivoRecusa: z.string().min(1, "Este campo é obrigatório.").max(2000),
})
