import { createAuthClient } from "better-auth/react"
import { phoneNumberClient } from "better-auth/client/plugins"

import { CUSTOMER_AUTH_PATH } from "./customer-auth-path"

// The browser side of customers' sign-in (lib/customer-auth.ts).
export const customerAuthClient = createAuthClient({
  basePath: CUSTOMER_AUTH_PATH,
  plugins: [phoneNumberClient()],
})
