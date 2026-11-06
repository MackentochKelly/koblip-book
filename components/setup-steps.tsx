"use client"

import Link from "next/link"

import { PageSection } from "@/components/page-section"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  ChevronDownIcon,
  ChevronRightIcon,
  CircleCheckIcon,
} from "@/components/ui/icons"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "@/components/ui/progress"
import { cn } from "@/lib/utils"

export type SetupStepItem = {
  id: string
  title: string
  // What to do, shown on the current step (not in a boxed list).
  hint?: string
  done: boolean
  // Where to do it: the whole row opens it.
  href?: string
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
// one marked, the rest muted. Steps with a link open it from the whole row.
// Folded away once all are done (or when the caller says). `boxed` puts it
// in a small bordered box with short rows (the home page's first steps);
// otherwise it is a page section (WhatsApp's own number).
export function SetupSteps({
  id,
  steps,
  labels,
  folded,
  boxed = false,
}: {
  // The section's anchor.
  id: string
  steps: SetupStepItem[]
  labels: SetupStepsLabels
  // Folded away; by default once every step is done.
  folded?: boolean
  boxed?: boolean
}) {
  const t = labels
  const done = steps.filter((step) => step.done).length
  const current = steps.find((step) => !step.done)

  const list = (
    <ItemGroup className={boxed ? "gap-0" : "gap-1"}>
      {steps.map((step, index) => {
        const isCurrent = step === current
        return (
          <Item
            key={step.id}
            role="listitem"
            size="sm"
            variant={isCurrent && !boxed ? "outline" : "default"}
            aria-current={isCurrent ? "step" : undefined}
            render={step.href ? <Link href={step.href} /> : undefined}
          >
            <ItemMedia variant="icon">
              {step.done ? (
                <CircleCheckIcon className="text-success" />
              ) : (
                <span
                  className={cn(
                    "flex size-4 items-center justify-center text-sm font-medium",
                    isCurrent ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {index + 1}
                </span>
              )}
            </ItemMedia>
            <ItemContent className="min-w-0">
              <ItemTitle
                className={cn(
                  !step.done && !isCurrent && "text-muted-foreground"
                )}
              >
                {step.title}
                <span className="sr-only">
                  {" "}
                  ({step.done ? t.done : isCurrent ? t.now : t.toDo})
                </span>
              </ItemTitle>
              {isCurrent && !boxed && (
                <ItemDescription className="line-clamp-none">
                  {step.hint}
                </ItemDescription>
              )}
            </ItemContent>
            {step.href && (
              <ItemActions>
                <ChevronRightIcon className="size-4 text-muted-foreground" />
              </ItemActions>
            )}
          </Item>
        )
      })}
    </ItemGroup>
  )

  const progress = (
    <Progress value={(done / steps.length) * 100}>
      <ProgressLabel className="sr-only">{t.title}</ProgressLabel>
      {!boxed && (
        <ProgressValue>{() => t.progress(done, steps.length)}</ProgressValue>
      )}
    </Progress>
  )

  if (boxed && !(folded ?? !current)) {
    return (
      <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-16">
        <Card size="sm" variant="muted" className="gap-3">
          <CardHeader>
            <CardTitle id={`${id}-title`}>{t.title}</CardTitle>
            <CardAction className="text-sm text-muted-foreground tabular-nums">
              {t.progress(done, steps.length)}
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {progress}
            <div className="-mx-2">{list}</div>
          </CardContent>
        </Card>
      </section>
    )
  }

  const content = (
    <div className="flex flex-col gap-4">
      {progress}
      {list}
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
