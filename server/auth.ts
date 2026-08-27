import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"

import { prisma } from "./prisma.js"

const configuredBaseURL = parseHttpUrl(process.env.BETTER_AUTH_URL)
const vercelHost =
  process.env.VERCEL_BRANCH_URL ??
  process.env.VERCEL_URL ??
  process.env.VERCEL_PROJECT_PRODUCTION_URL
const vercelBaseURL = parseHttpUrl(vercelHost ? `https://${vercelHost}` : undefined)
const baseURL = configuredBaseURL ?? vercelBaseURL
const secret = process.env.BETTER_AUTH_SECRET

if (!baseURL) {
  throw new Error(
    "Não foi possível determinar uma URL válida para o Better Auth. Configure BETTER_AUTH_URL ou habilite as system environment variables da Vercel.",
  )
}

if (!configuredBaseURL && process.env.BETTER_AUTH_URL && vercelBaseURL) {
  console.warn("BETTER_AUTH_URL inválida; usando a URL fornecida pela Vercel.")
}

if (!secret) {
  throw new Error("BETTER_AUTH_SECRET não foi configurada.")
}

export const auth = betterAuth({
  appName: "D&D Manager",

  baseURL,
  secret,

  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  emailAndPassword: {
    enabled: true,
  },
})

function parseHttpUrl(value: string | undefined): string | undefined {
  if (!value) return undefined

  try {
    const url = new URL(value.trim())
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined
    return url.origin
  } catch {
    return undefined
  }
}
