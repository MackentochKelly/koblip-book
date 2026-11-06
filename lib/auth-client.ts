import { phoneNumberClient } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

// The browser side of lib/auth.ts, with its phone sign-in.
export const authClient = createAuthClient({
  plugins: [phoneNumberClient()],
})
