"use client"

import Link from "next/link"

import { PageSection } from "@/components/page-section"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ChevronDownIcon, CircleCheckIcon } from "@/components/ui/icons"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemActions,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

export type SetupStepItem = {
  id: string
  title: string
  // What to do, shown on the current step only.
  hint: string
  done: boolean
  // Where to do it, as a button on the current step.
  action?: { label: string; href: string }
}

export type SetupStepsLabels = {
  title: string
  progress: (done: number, total: number) => string
  // The folded trigger once every step is done.
  allDone: string
  // For screen readers, after each step's title.
  done: string
  now: string
  toDo: string
}

// A setup guide: steps in order with a bar, done ones checked, the current
// one marked with what to do, the rest muted. Folded away once all are done
// (or when the caller says).
// Any setup reuses it (WhatsApp's own number, a new owner's first steps).
export function SetupSteps({
  id,
  steps,
  labels,
  folded,
}: {
  // The section's anchor.
  id: string
  steps: SetupStepItem[]
  labels: SetupStepsLabels
  // Folded away; by default once every step is done.
  folded?: boolean
}) {
  const t = labels
  const done = steps.filter((step) => step.done).length
  const current = steps.find((step) => !step.done)

  const content = (
    <div className="flex flex-col gap-4">
      <Progress value={(done / steps.length) * 100}>
        <ProgressLabel className="sr-only">{t.title}</ProgressLabel>
        <ProgressValue>{() => t.progress(done, steps.length)}</ProgressValue>
      </Progress>
      <ItemGroup className="gap-1">
        {steps.map((step, index) => {
          const isCurrent = step === current
          return (
            <Item
              key={step.id}
              role="listitem"
              size="sm"
              variant={isCurrent ? "outline" : "default"}
              aria-current={isCurrent ? "step" : undefined}
            >
              <ItemMedia variant="icon">
                {step.done ? (
                  <CircleCheckIcon className="text-success" />
                ) : (
                  <span
                    className={cn(
                      "text-sm font-medium",
                      isCurrent ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {index + 1}
                  </span>
                )}
              </ItemMedia>
              <ItemContent className="min-w-0">
                <ItemTitle className={cn(!step.done && !isCurrent && "text-muted-foreground")}>
                  {step.title}
                  <span className="sr-only">
                    {" "}
                    ({step.done ? t.done : isCurrent ? t.now : t.toDo})
                  </span>
                </ItemTitle>
                {isCurrent && (
                  <ItemDescription className="line-clamp-none">{step.hint}</ItemDescription>
                )}
              </ItemContent>
              {isCurrent && step.action && (
                <ItemActions>
                  <Button
                    size="sm"
                    nativeButton={false}
                    render={<Link href={step.action.href} />}
                  >
                    {step.action.label}
                  </Button>
                </ItemActions>
              )}
            </Item>
          )
        })}
      </ItemGroup>
    </div>
  )

  if (folded ?? !current) {
    return (
      <Collapsible>
        <CollapsibleTrigger
          render={<Button variant="ghost" className="group -ml-2.5 w-fit" />}
        >
          <CircleCheckIcon data-icon="inline-start" className="text-success" />
          {t.allDone}
          <ChevronDownIcon
            data-icon="inline-end"
            className="transition-transform group-data-[panel-open]:rotate-180"
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4">{content}</CollapsibleContent>
      </Collapsible>
    )
  }
  return (
    <PageSection id={id} title={t.title}>
      {content}
    </PageSection>
  )
}
