import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Button } from "@/components/ui/button"

// A WhatsApp message as the person will see it: the bubble with its title,
// text and footer, and its reply buttons under it. For looking only.
export function WhatsappPreview({
  header,
  body,
  footer,
  buttons,
}: {
  header: string
  body: string
  footer: string
  buttons: { key: string; label: string }[]
}) {
  return (
    <div inert className="flex flex-col gap-1 rounded-xl bg-muted p-3">
      <Bubble variant="outline">
        <BubbleContent className="flex flex-col gap-1 whitespace-pre-wrap">
          <span className="font-semibold">{header}</span>
          <span>{body}</span>
          {footer && <span className="text-xs text-muted-foreground">{footer}</span>}
        </BubbleContent>
      </Bubble>
      {buttons.map((button) => (
        <Button key={button.key} type="button" variant="outline" tabIndex={-1}>
          {button.label}
        </Button>
      ))}
    </div>
  )
}
