import { CircleAlertIcon } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"

// What went wrong with Google sign-in, from the `error` it came back with
// (better-auth.com/docs/concepts/users-accounts#account-linking).
// account_not_linked: the email already has a password account that was
// never verified, so Google is not joined to it (that keeps someone who
// signed up with another person's email out of their account).
const MESSAGES: Record<string, string> = {
  account_not_linked:
    "This email already has a password. Log in with it below.",
}

const FALLBACK = "Google sign-in didn't work. Try again."

export function GoogleError({ code }: { code: string }) {
  const message = MESSAGES[code.replaceAll(" ", "_")] ?? FALLBACK
  return (
    <Alert variant="destructive">
      <CircleAlertIcon />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}
