import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"

import { prisma } from "./prisma"

const baseURL = process.env.BETTER_AUTH_URL
const secret = process.env.BETTER_AUTH_SECRET

if (!baseURL) {
  throw new Error("BETTER_AUTH_URL não foi configurada.")
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