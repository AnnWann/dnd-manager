import { config as loadEnv } from "dotenv"
import { defineConfig, env } from "prisma/config"

// Prisma CLI does not use Vite's env loading, so load local development
// variables explicitly. Existing process variables (for example Vercel/CI)
// keep precedence because dotenv does not override them by default.
loadEnv({ path: ".env.local" })
loadEnv()

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DIRECT_URL"),
  },
})