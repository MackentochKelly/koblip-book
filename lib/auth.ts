import "server-only"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { nextCookies } from "better-auth/next-js"
import { db } from "./db"
import * as authSchema from "./db/auth-schema"
import { ONBOARDING_RULES } from "./onboarding-rules"

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, { provider: "sqlite", schema: authSchema }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: ONBOARDING_RULES.minPasswordLength,
  },
  advanced: { database: { generateId: () => crypto.randomUUID() } },
  plugins: [nextCookies()],
})
