// The `next` value screens pass after sign-in. Only a same-site path is
// safe; anything else falls back to the dashboard.
export function safeNext(value: string | null | undefined): string {
  if (
    typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.startsWith("/\\")
  ) {
    return value
  }
  return "/dashboard"
}
