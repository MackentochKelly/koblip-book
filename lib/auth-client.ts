import { stripeClient } from "@better-auth/stripe/client"
import { phoneNumberClient } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

// The browser side of lib/auth.ts, with its phone sign-in and app
// subscriptions (better-auth.com/docs/plugins/stripe#add-the-client-plugin).
export const authClient = createAuthClient({
  plugins: [phoneNumberClient(), stripeClient({ subscription: true })],
})
