import { Alert, AlertDescription } from "@/components/ui/alert"
import { CircleAlertIcon, InfoIcon, MailIcon } from "@/components/ui/icons"

const KINDS = {
  info: { variant: "default", Icon: InfoIcon },
  mail: { variant: "default", Icon: MailIcon },
  error: { variant: "destructive", Icon: CircleAlertIcon },
} as const

// One line of news on the account screens: a calm tip, or what went wrong.
export function AuthNotice({
  kind,
  children,
}: {
  kind: keyof typeof KINDS
  children: React.ReactNode
}) {
  const { variant, Icon } = KINDS[kind]
  return (
    <Alert variant={variant}>
      <Icon />
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  )
}
