"use client"

import { useTranslations } from "next-intl"

import { SetupSteps } from "@/components/setup-steps"
import type { SetupTaskState } from "../utils/setup-tasks"

// The home page's first steps for a new owner in a small box; each row
// opens where that step is done. The page leaves it out once every step is done.
export function SetupList({ steps }: { steps: SetupTaskState[] }) {
  const t = useTranslations("owner.settings.setup")
  return (
    <SetupSteps
      id="setup"
      boxed
      steps={steps.map((step) => ({
        id: step.id,
        title: t(`steps.${step.id}`),
        done: step.done,
        href: step.href,
      }))}
      labels={{
        title: t("title"),
        progress: (done, total) => t("progress", { done, total }),
        allDone: t("allDone"),
        done: t("done"),
        now: t("now"),
        toDo: t("toDo"),
      }}
    />
  )
}
