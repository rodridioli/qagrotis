/**
 * Leituras de UserProfile / CreatedUser sem `dataNascimento` no SELECT.
 * Evita erro Prisma quando o banco de produção ainda não recebeu a migração
 * que adiciona a coluna (deploy sem `prisma migrate deploy`).
 */
export const USER_PROFILE_READ_SELECT = {
  userId: true,
  name: true,
  email: true,
  type: true,
  classificacao: true,
  photoPath: true,
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
} as const
