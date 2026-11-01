"use client"

import { AnimatePresence, motion, useReducedMotion } from "motion/react"

import { CircleCheckFilledIcon, type Icon } from "@/components/ui/icons"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

export type StepRevealState = "waiting" | "working" | "done"

export type StepRevealItem = {
  id: string
  icon: Icon
  title: string
  state: StepRevealState
  // Shown under the title once the step is done.
  detail?: React.ReactNode
  // Next to the tick, while working or done (e.g. avatars).
  aside?: React.ReactNode
}

// A setup screen that fills in row by row: a picture, a title and one line,
// then each step going from waiting to working to done with what it found.
// Used while Muse prepares a page and when a page's Google Maps details are
// shown after sign-up.
export function StepReveal({
  media,
  title,
  helper,
  steps,
  labels,
}: {
  media: React.ReactNode
  title: string
  helper: string
  steps: StepRevealItem[]
  // For screen readers, next to each step.
  labels: { working: string; done: string; waiting: string }
}) {
  const reduceMotion = useReducedMotion()
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-muted">
          {media}
        </span>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-balance">{title}</h1>
          <p className="text-muted-foreground">{helper}</p>
        </div>
      </div>

      <ItemGroup role="list" aria-live="polite">
        {steps.map(({ id, icon: StepIcon, title: stepTitle, state, detail, aside }) => (
          <Item
            key={id}
            role="listitem"
            size="sm"
            className={cn(
              "transition-opacity duration-300",
              state === "waiting" && "opacity-50"
            )}
          >
            <ItemMedia variant="icon">
              <StepIcon />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>{stepTitle}</ItemTitle>
              <AnimatePresence initial={false}>
                {state === "done" && detail && (
                  <motion.div
                    initial={{ opacity: 0, y: reduceMotion ? 0 : 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ItemDescription>{detail}</ItemDescription>
                  </motion.div>
                )}
              </AnimatePresence>
            </ItemContent>
            {state !== "waiting" && aside}
            <span className="flex size-6 items-center justify-center text-muted-foreground">
              {state === "working" && <Spinner aria-label={labels.working} />}
              {state === "done" && (
                <CircleCheckFilledIcon className="size-5 text-success" aria-label={labels.done} />
              )}
              {state === "waiting" && <span className="sr-only">{labels.waiting}</span>}
            </span>
          </Item>
        ))}
      </ItemGroup>
    </div>
  )
}
