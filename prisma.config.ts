import { defineConfig } from "prisma/config"

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error(
    "[prisma.config] DATABASE_URL is not defined.\n" +
      "Copy .env.example → .env and set DATABASE_URL."
  )
}

export default defineConfig({
  datasource: {
    url: databaseUrl,
  },
})
