export type BadgeCategoryId = "tempo" | "chapters" | "feedbacks" | "formacao" | "idioma"

export interface BadgeDefinition {
  id: string
  categoryId: BadgeCategoryId
  label: string
}

export interface BadgeResult {
  id: string
  unlocked: boolean
}

export interface ListUserBadgesResponse {
  badges: BadgeResult[]
  tenureMonths: number
}

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  // Tempo de Empresa
  { id: "tempo-6m",      categoryId: "tempo",     label: "6 Meses"          },
  { id: "tempo-1y",      categoryId: "tempo",     label: "1 Ano"            },
  { id: "tempo-2y",      categoryId: "tempo",     label: "2 Anos"           },
  { id: "tempo-5y",      categoryId: "tempo",     label: "5 Anos"           },
  { id: "tempo-8y",      categoryId: "tempo",     label: "8 Anos"           },
  { id: "tempo-10y",     categoryId: "tempo",     label: "10 Anos"          },
  { id: "tempo-15y",     categoryId: "tempo",     label: "15 Anos"          },
  // Chapters Apresentados
  { id: "chapter-1",     categoryId: "chapters",  label: "1 Chapter"        },
  { id: "chapter-5",     categoryId: "chapters",  label: "5 Chapters"       },
  { id: "chapter-10",    categoryId: "chapters",  label: "10 Chapters"      },
  { id: "chapter-15",    categoryId: "chapters",  label: "15 Chapters"      },
  { id: "chapter-20",    categoryId: "chapters",  label: "20 Chapters"      },
  // Feedbacks Positivos
  { id: "fp-1",          categoryId: "feedbacks", label: "1 Feedback"       },
  { id: "fp-5",          categoryId: "feedbacks", label: "5 Feedbacks"      },
  { id: "fp-10",         categoryId: "feedbacks", label: "10 Feedbacks"     },
  { id: "fp-15",         categoryId: "feedbacks", label: "15 Feedbacks"     },
  { id: "fp-20",         categoryId: "feedbacks", label: "20 Feedbacks"     },
  { id: "fp-30",         categoryId: "feedbacks", label: "30 Feedbacks"     },
  { id: "fp-40",         categoryId: "feedbacks", label: "40 Feedbacks"     },
  // Formação Acadêmica
  { id: "form-grad",     categoryId: "formacao",  label: "Graduação"        },
  { id: "form-pos",      categoryId: "formacao",  label: "Pós-Graduação"    },
  { id: "form-cert",     categoryId: "formacao",  label: "Certificação"     },
  { id: "form-cursos",   categoryId: "formacao",  label: "10 Cursos"        },
  { id: "form-mest",     categoryId: "formacao",  label: "Mestrado"         },
  { id: "form-dout",     categoryId: "formacao",  label: "Doutorado"        },
  { id: "form-posdout",  categoryId: "formacao",  label: "Pós-Doutorado"    },
  // Idioma Adicional
  { id: "lang-basic",    categoryId: "idioma",    label: "Básico"           },
  { id: "lang-inter",    categoryId: "idioma",    label: "Intermediário"    },
  { id: "lang-avanc",    categoryId: "idioma",    label: "Avançado"         },
  { id: "lang-fluente",  categoryId: "idioma",    label: "Fluente / Nativo" },
]

export const BADGE_CATEGORIES: { id: BadgeCategoryId; label: string }[] = [
  { id: "tempo",     label: "Tempo de Empresa"      },
  { id: "chapters",  label: "Chapters Apresentados" },
  { id: "feedbacks", label: "Feedbacks Positivos"   },
  { id: "formacao",  label: "Formação Acadêmica"    },
  { id: "idioma",    label: "Idioma Adicional"       },
]

export const LANGUAGE_LEVEL_ORDER = [
  "Básico",
  "Intermediário",
  "Avançado",
  "Fluente / Nativo",
] as const
