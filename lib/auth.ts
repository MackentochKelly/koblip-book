import "server-only"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { nextCookies } from "better-auth/next-js"
import { admin, anonymous } from "better-auth/plugins"
import { db } from "./db"
import * as authSchema from "./db/auth-schema"
import { sendEmail } from "./email"
import { verificationEmail } from "./email-templates"
import { ONBOARDING_RULES } from "./onboarding-rules"

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, { provider: "sqlite", schema: authSchema }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: ONBOARDING_RULES.minPasswordLength,
  },
  // Password sign-ups verify their email so Google can later join the
  // same account (accountLinking stays strict). Owners are NOT blocked
  // before verification: claiming keeps working straight after sign-up.
  emailVerification: {
    sendVerificationEmail: ({ user, url }) => {
      const content = verificationEmail(url)
      void sendEmail({ to: user.email, ...content })
      return Promise.resolve()
    },
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    expiresIn: ONBOARDING_RULES.emailVerificationHours * 3600,
  },
  // Auth errors (OAuth state mismatch, bad callback…) land on the login
  // page instead of the default /api/auth/error page.
  onAPIError: { errorURL: "/login" },
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
  // The app owner's admin area (better-auth.com/docs/plugins/admin): the
  // accounts in ADMIN_USER_IDS (comma-separated user ids, .env.local) are
  // admins; everyone else is an owner. Adds role and ban fields.
  plugins: [
    admin({
      adminUserIds: (process.env.ADMIN_USER_IDS ?? "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean),
    }),
    // Home page demo visitors (better-auth.com/docs/plugins/anonymous): a
    // session with no account, so the real dashboard and assistant can run
    // on the visitor's own demo copy. A guest owns nothing but that copy
    // (features/demo). Signing up later deletes the guest, as by default.
    anonymous({ generateName: () => "Demo" }),
    // Must stay last (better-auth.com/docs/integrations/next).
    nextCookies(),
  ],
})
