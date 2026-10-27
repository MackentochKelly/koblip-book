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
  // Google login (better-auth.com/docs/authentication/google): the keys come
  // from Google Cloud > Google Auth Platform > Clients. The redirect URI
  // there is <BETTER_AUTH_URL>/api/auth/callback/google.
  socialProviders:
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          },
        }
      : undefined,
  advanced: { database: { generateId: () => crypto.randomUUID() } },
  plugins: [nextCookies()],
})
