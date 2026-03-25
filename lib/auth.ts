import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import Credentials from "next-auth/providers/credentials"
import { authConfig } from "@/lib/auth.config"
import { promises as fs } from "fs"
import path from "path"
import { MOCK_USERS } from "@/lib/qagrotis-constants"
import { PROTOTYPE_USERS } from "@/lib/prototype-users"

// Inline credential validation (can't import "use server" actions here)
async function checkCredentials(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase()
  const DATA_DIR = path.join(process.cwd(), "data")

  const [inactiveRaw, createdRaw] = await Promise.all([
    fs.readFile(path.join(DATA_DIR, "inactive-users.json"), "utf-8").catch(() => "[]"),
    fs.readFile(path.join(DATA_DIR, "created-users.json"), "utf-8").catch(() => "[]"),
  ])

  const inactiveIds = new Set<string>(JSON.parse(inactiveRaw) as string[])
  const createdUsers = JSON.parse(createdRaw) as Array<{
    id: string; email: string; password: string
  }>

  // Check dynamically created users
  const createdUser = createdUsers.find((u) => u.email.toLowerCase() === normalizedEmail)
  if (createdUser) {
    if (createdUser.password !== password) return null
    if (inactiveIds.has(createdUser.id)) return null
    return { id: createdUser.id, email: createdUser.email, name: createdUser.email }
  }

  // Check MOCK_USERS with PROTOTYPE_USERS passwords
  const mockUser = MOCK_USERS.find((u) => u.email.toLowerCase() === normalizedEmail)
  if (mockUser) {
    const expectedPassword = PROTOTYPE_USERS[normalizedEmail] ?? "admin"
    if (password !== expectedPassword) return null
    if (inactiveIds.has(mockUser.id)) return null
    return { id: mockUser.id, email: mockUser.email, name: mockUser.name }
  }

  return null
}

const providers = [
  Credentials({
    credentials: {
      email: { label: "E-mail", type: "email" },
      password: { label: "Senha", type: "password" },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) return null
      return checkCredentials(
        credentials.email as string,
        credentials.password as string
      )
    },
  }),
]

if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }) as never
  )
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers,
  session: { strategy: "jwt" },
  callbacks: {
    jwt({ token, user }) {
      if (user) token.id = user.id
      return token
    },
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string
      }
      return session
    },
  },
})
