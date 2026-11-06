import "server-only"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api"
import { parseCookies } from "better-auth/cookies"
import { nextCookies } from "better-auth/next-js"
import { admin, anonymous, phoneNumber } from "better-auth/plugins"
import { stripe } from "@better-auth/stripe"
import { eq } from "drizzle-orm"
import { ACCOUNT_RULES } from "./account-rules"
import { LOGIN_PATH } from "./auth-links"
import { db } from "./db"
import * as authSchema from "./db/auth-schema"
import { bookings } from "./db/schema"
import { sendEmail } from "./email"
import { deletePhoto } from "./uploads"
import { stripeClient, stripeKeys } from "./stripe"
import { PAID_PLANS } from "./subscription-rules"
import { resetPasswordEmail, verificationEmail } from "./email-templates"
import { ONBOARDING_RULES } from "./onboarding-rules"
import { canBillBusiness } from "./plan-access"
import {
  isSignInPhone,
  latestBookingName,
  PHONE_SIGN_IN_RULES,
  phoneAccountEmail,
  sendPhoneCode,
} from "./phone-sign-in"
import {
  OWNER_LANGUAGE_COOKIE,
  pickOwnerLanguage,
  type PageLanguage,
} from "./page-language"

// An email speaks the language of the screen that asked for it: the owner's
// pick, else the phone's language.
function emailLanguage(request: Request | undefined): PageLanguage {
  const headers = request?.headers
  return pickOwnerLanguage(
    parseCookies(headers?.get("cookie") ?? "").get(OWNER_LANGUAGE_COOKIE),
    headers?.get("accept-language") ?? null
  )
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
      void resetPasswordEmail(url, emailLanguage(request)).then((content) =>
        sendEmail({ to: user.email, ...content })
      )
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
      void verificationEmail(url, emailLanguage(request)).then((content) =>
        sendEmail({ to: user.email, ...content })
      )
      return Promise.resolve()
    },
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    expiresIn: ONBOARDING_RULES.emailVerificationHours * 3600,
  },
  // Auth errors (OAuth state mismatch, bad callback…) land on the login
  // page instead of the default /api/auth/error page.
  onAPIError: { errorURL: LOGIN_PATH },
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
  // Phone sign-in is by code only: the phone-number plugin's password
  // routes stay off.
  disabledPaths: [
    "/sign-in/phone-number",
    "/phone-number/request-password-reset",
    "/phone-number/reset-password",
  ],
  rateLimit: {
    customRules: {
      "/phone-number/send-otp": {
        window: 60,
        max: PHONE_SIGN_IN_RULES.codesPerMinute,
      },
    },
  },
  // A plan is bought for a business, never for the person (S2): an upgrade
  // must name a business its owner may bill. The Stripe plugin checks other
  // business ids through authorizeReference below, but skips the check when
  // no id or the user's own id is sent, so the upgrade is stopped here
  // (better-auth.com/docs/concepts/hooks).
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/subscription/upgrade") return
      const referenceId: unknown = ctx.body?.referenceId
      const session = await getSessionFromCtx(ctx)
      if (
        !session ||
        typeof referenceId !== "string" ||
        !(await canBillBusiness(session.user.id, referenceId))
      ) {
        throw new APIError("UNAUTHORIZED", { message: "Not your business" })
      }
    }),
  },
  // An account a phone creates takes the name its latest booking gave.
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const phone = (user as { phoneNumber?: string | null }).phoneNumber
          const name = phone ? await latestBookingName(phone) : null
          return { data: { ...user, name: name ?? user.name } }
        },
      },
      // However an account goes (its own Settings, the owner's, the admin):
      // its bookings stay with the businesses, no longer the account's
      // (docs/plans/client-account.md, D7), and its uploaded photo goes.
      delete: {
        before: async (user) => {
          await db
            .update(bookings)
            .set({ customerUserId: null })
            .where(eq(bookings.customerUserId, user.id))
          await deletePhoto(user.image ?? null)
        },
      },
    },
  },
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
    // Sign in with a phone and a code sent to it
    // (better-auth.com/docs/plugins/phone-number), for any account. A new
    // phone makes a new account; a signed-in account can add its phone
    // (verify with updatePhoneNumber), so My bookings finds its bookings.
    phoneNumber({
      expiresIn: PHONE_SIGN_IN_RULES.codeMinutes * 60,
      allowedAttempts: PHONE_SIGN_IN_RULES.codeTries,
      phoneNumberValidator: isSignInPhone,
      sendOTP: ({ phoneNumber: phone, code }) => sendPhoneCode(phone, code),
      signUpOnVerification: { getTempEmail: phoneAccountEmail },
    }),
    // App subscriptions (better-auth.com/docs/plugins/stripe,
    // docs/plans/subscriptions.md): Stripe Checkout and the Customer Portal,
    // kept in step by the webhook at /api/auth/stripe/webhook. The Stripe
    // customer is made at the first checkout, not at sign-up, so customers
    // and demo guests never get one. Off without the Stripe keys.
    ...(stripeClient && stripeKeys
      ? [
          stripe({
            stripeClient,
            stripeWebhookSecret: stripeKeys.webhookSecret,
            subscription: {
              enabled: true,
              plans: PAID_PLANS.map((plan) => ({ ...plan })),
              // referenceId is a business id; only its owner acts on it.
              authorizeReference: ({ user, referenceId }) =>
                canBillBusiness(user.id, referenceId),
            },
          }),
        ]
      : []),
    // Must stay last (better-auth.com/docs/integrations/next).
    nextCookies(),
  ],
})
