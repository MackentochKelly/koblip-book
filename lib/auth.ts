import "server-only"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { parseCookies } from "better-auth/cookies"
import { nextCookies } from "better-auth/next-js"
import { admin, anonymous } from "better-auth/plugins"
import { eq } from "drizzle-orm"
import { ACCOUNT_RULES } from "./account-rules"
import { db } from "./db"
import * as authSchema from "./db/auth-schema"
import { sendEmail } from "./email"
import { resetPasswordEmail, verificationEmail } from "./email-templates"
import { ONBOARDING_RULES } from "./onboarding-rules"
import {
  isPageLanguage,
  OWNER_LANGUAGE_COOKIE,
  pickLanguage,
  type PageLanguage,
} from "./page-language"

// An email speaks the language of the screen that asked for it: the owner's
// pick, else the phone's language.
function emailLanguage(request: Request | undefined): PageLanguage {
  const headers = request?.headers
  const picked = parseCookies(headers?.get("cookie") ?? "").get(
    OWNER_LANGUAGE_COOKIE
  )
  return isPageLanguage(picked)
    ? picked
    : pickLanguage(undefined, headers?.get("accept-language") ?? null)
}

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, { provider: "sqlite", schema: authSchema }),
  // Emails go out without being awaited, so a request's timing can't tell
  // which addresses have accounts
  // (better-auth.com/docs/authentication/email-password#request-password-reset).
  emailAndPassword: {
    enabled: true,
    minPasswordLength: ONBOARDING_RULES.minPasswordLength,
    maxPasswordLength: ONBOARDING_RULES.maxPasswordLength,
    resetPasswordTokenExpiresIn: ACCOUNT_RULES.passwordResetMinutes * 60,
    sendResetPassword: ({ user, url }, request) => {
      const content = resetPasswordEmail(url, emailLanguage(request))
      void sendEmail({ to: user.email, ...content })
      return Promise.resolve()
    },
    // Anyone who signed up with another person's email before them loses
    // the way in: the password is replaced and their sessions end.
    revokeSessionsOnPasswordReset: true,
    // Only the mailbox's owner gets this link, and whoever had a password
    // or session before is out by now, so the email counts as confirmed and
    // Google can join the account.
    onPasswordReset: async ({ user }) => {
      if (user.emailVerified) return
      await db
        .update(authSchema.user)
        .set({ emailVerified: true })
        .where(eq(authSchema.user.id, user.id))
    },
  },
  // Password sign-ups verify their email so Google can later join the
  // same account (accountLinking stays strict). Owners are NOT blocked
  // before verification: claiming keeps working straight after sign-up.
  emailVerification: {
    sendVerificationEmail: ({ user, url }, request) => {
      const content = verificationEmail(url, emailLanguage(request))
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
  // Owners delete their own account in Settings → Account
  // (better-auth.com/docs/concepts/users-accounts#delete-user); their
  // businesses go first (features/dashboard/api/delete-actions.ts).
  user: { deleteUser: { enabled: true } },
  session: { freshAge: ACCOUNT_RULES.freshLoginHours * 3600 },
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
