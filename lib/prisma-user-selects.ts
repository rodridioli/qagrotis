/**
 * Leituras de UserProfile / CreatedUser.
 * Chame `ensureUserDataNascimentoColumns` e `ensureUserWorkScheduleColumns` antes das queries
 * se o deploy ainda não aplicou migrações (ADD COLUMN IF NOT EXISTS no ensure).
 */
export const USER_PROFILE_READ_SELECT = {
  userId: true,
  name: true,
  email: true,
  type: true,
  classificacao: true,
  photoPath: true,
  dataNascimento: true,
  horarioEntrada: true,
  horarioSaida: true,
  formatoTrabalho: true,
} as const

export const CREATED_USER_READ_SELECT = {
  id: true,
  name: true,
  email: true,
  type: true,
  classificacao: true,
  photoPath: true,
  password: true,
  createdAt: true,
  dataNascimento: true,
  horarioEntrada: true,
  horarioSaida: true,
  formatoTrabalho: true,
} as const
