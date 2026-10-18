import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"

import { prisma } from "./prisma.js"

const configuredBaseURL = parseHttpUrl(process.env.BETTER_AUTH_URL)
const vercelBranchBaseURL = parseVercelUrl(process.env.VERCEL_BRANCH_URL)
const vercelDeploymentBaseURL = parseVercelUrl(process.env.VERCEL_URL)
const vercelProductionBaseURL = parseVercelUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL)
const baseURL =
  configuredBaseURL ??
  vercelBranchBaseURL ??
  vercelDeploymentBaseURL ??
  vercelProductionBaseURL
const trustedOrigins = [
  configuredBaseURL,
  vercelBranchBaseURL,
  vercelDeploymentBaseURL,
  vercelProductionBaseURL,
].filter((origin, index, origins): origin is string =>
  Boolean(origin) && origins.indexOf(origin) === index,
)
const secret = process.env.BETTER_AUTH_SECRET

if (!baseURL) {
  throw new Error(
    "Não foi possível determinar uma URL válida para o Better Auth. Configure BETTER_AUTH_URL ou habilite as system environment variables da Vercel.",
  )
}

if (!configuredBaseURL && process.env.BETTER_AUTH_URL && vercelDeploymentBaseURL) {
  console.warn("BETTER_AUTH_URL inválida; usando a URL fornecida pela Vercel.")
}

if (!secret) {
  throw new Error("BETTER_AUTH_SECRET não foi configurada.")
}

export const auth = betterAuth({
  appName: "D&D Manager",

  baseURL,
  trustedOrigins,
  secret,

  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  emailAndPassword: {
    enabled: true,
  },
})

function parseVercelUrl(value: string | undefined): string | undefined {
  return parseHttpUrl(value ? `https://${value}` : undefined)
}

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
