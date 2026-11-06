import "server-only"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { nextCookies } from "better-auth/next-js"
import { phoneNumber } from "better-auth/plugins"

import { CUSTOMER_AUTH_PATH } from "./customer-auth-path"
import {
  isCustomerPhone,
  latestBookingName,
  sendSignInCode,
  SIGN_IN_RULES,
} from "./customer-sign-in"
import { db } from "./db"
import {
  customerAccount,
  customerSession,
  customerUser,
  customerVerification,
} from "./db/customer-auth-schema"

// Customers' sign-in, apart from the owners' (lib/auth.ts): its own tables,
// address and cookies, so the two never mix. A customer signs in with the
// phone they booked with and a code sent to it
// (better-auth.com/docs/plugins/phone-number); the first sign-in makes their
// profile, named from their latest booking.
export const customerAuth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  basePath: CUSTOMER_AUTH_PATH,
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: {
      customerUser,
      customerSession,
      customerAccount,
      customerVerification,
    },
  }),
  user: { modelName: "customerUser" },
  session: {
    modelName: "customerSession",
    expiresIn: SIGN_IN_RULES.sessionDays * 24 * 3600,
  },
  account: { modelName: "customerAccount" },
  verification: { modelName: "customerVerification" },
  advanced: {
    cookiePrefix: "koblip-customer",
    database: { generateId: () => crypto.randomUUID() },
  },
  // Phone and code only: no passwords, no email sign-in.
  disabledPaths: [
    "/sign-in/phone-number",
    "/phone-number/request-password-reset",
    "/phone-number/reset-password",
    "/sign-up/email",
    "/sign-in/email",
  ],
  rateLimit: {
    customRules: {
      "/phone-number/send-otp": {
        window: 60,
        max: SIGN_IN_RULES.codesPerMinute,
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const phone = (user as { phoneNumber?: string | null }).phoneNumber
          const name = phone ? await latestBookingName(phone) : null
          return { data: { ...user, name: name ?? user.name } }
        },
      },
    },
  },
  plugins: [
    phoneNumber({
      expiresIn: SIGN_IN_RULES.codeMinutes * 60,
      allowedAttempts: SIGN_IN_RULES.codeTries,
      phoneNumberValidator: isCustomerPhone,
      sendOTP: ({ phoneNumber: phone, code }) => sendSignInCode(phone, code),
      signUpOnVerification: {
        // A reserved domain (RFC 2606): never a real address, never mailed.
        getTempEmail: (phone) => `${phone.replace(/\D/g, "")}@phone.invalid`,
      },
    }),
    // Must stay last (better-auth.com/docs/integrations/next).
    nextCookies(),
  ],
})
