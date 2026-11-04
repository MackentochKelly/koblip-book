import { AFTER_LOGIN_PATH } from "./auth-links"

// The `next` value screens pass after login. Only a same-site path is
// safe; anything else lands where a login does.
export function safeNext(value: string | null | undefined): string {
  if (
    typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.startsWith("/\\")
  ) {
    return value
  }
  return AFTER_LOGIN_PATH
}
