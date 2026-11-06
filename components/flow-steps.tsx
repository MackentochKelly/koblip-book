import { type Tone, ToneIcon } from "@/components/tone-icon"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"

export type FlowStep = {
  id: string
  icon: React.ReactNode
  tone?: Tone
  // A short word over the title: "When", "Send", "Button".
  kicker: string
  title: string
  description?: string
  // What follows from this step, e.g. each button and what it does.
  branches?: FlowStep[]
}

// An automation as steps, top to bottom, joined by a thin line: what starts
// it, what it sends, and each button with what it does under it. Built for a
// phone first; any flow reuses it (WhatsApp's Welcome, later ones).
export function FlowSteps({ steps, label }: { steps: FlowStep[]; label: string }) {
  return (
    <ol aria-label={label} className="flex flex-col">
      {steps.map((step, index) => (
        <StepRow key={step.id} step={step} last={index === steps.length - 1} />
      ))}
    </ol>
  )
}

function StepRow({ step, last }: { step: FlowStep; last: boolean }) {
  return (
    <li className="relative flex flex-col gap-2 pb-4 last:pb-0">
      {/* The line to the next step, under the icon's centre. */}
      {!last && (
        <span aria-hidden className="absolute top-12 bottom-0 left-8 w-px bg-border" />
      )}
      <StepItem step={step} className="relative" />
      {/* The branches: w-auto, so the indent comes out of the width
          instead of pushing past the screen. */}
      {step.branches && step.branches.length > 0 && (
        <ItemGroup role="list" className="ml-8 w-auto gap-2 border-l pl-4">
          {step.branches.map((branch) => (
            <StepItem key={branch.id} step={branch} role="listitem" />
          ))}
        </ItemGroup>
      )}
    </li>
  )
}

// One step's card: its icon, the short word over it, its title and line.
function StepItem({
  step,
  ...props
}: { step: FlowStep } & Omit<React.ComponentProps<typeof Item>, "children">) {
  return (
    <Item variant="outline" size="sm" {...props}>
      <ItemMedia>
        <ToneIcon tone={step.tone}>{step.icon}</ToneIcon>
      </ItemMedia>
      <ItemContent className="min-w-0">
        <ItemDescription>{step.kicker}</ItemDescription>
        <ItemTitle className="line-clamp-none">{step.title}</ItemTitle>
        {step.description && (
          <ItemDescription className="line-clamp-none">{step.description}</ItemDescription>
        )}
      </ItemContent>
    </Item>
  )
}
