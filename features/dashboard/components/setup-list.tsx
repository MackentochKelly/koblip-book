"use client"

import { SetupSteps } from "@/components/setup-steps"
import { useOwnerMessages } from "../i18n/provider"
import type { SetupTaskState } from "../utils/setup-tasks"

// The home page's first steps for a new owner, each with a button to where
// it is done. The page leaves it out once every step is done.
export function SetupList({ steps }: { steps: SetupTaskState[] }) {
  const t = useOwnerMessages().settings.setup
  return (
    <SetupSteps
      id="setup"
      steps={steps.map((step) => ({
        id: step.id,
        title: t.steps[step.id],
        hint: t.hints[step.id],
        done: step.done,
        action: { label: t.actions[step.id], href: step.href },
      }))}
      labels={{
        title: t.title,
        progress: t.progress,
        allDone: t.allDone,
        done: t.done,
        now: t.now,
        toDo: t.toDo,
      }}
    />
  )
}
