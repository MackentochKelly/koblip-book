import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

// The one main action of an account screen.
export function AuthSubmit({
  busy,
  children,
}: {
  busy: boolean
  children: React.ReactNode
}) {
  return (
    <Button type="submit" size="lg" disabled={busy}>
      {busy && <Spinner data-icon="inline-start" />}
      {children}
    </Button>
  )
}
