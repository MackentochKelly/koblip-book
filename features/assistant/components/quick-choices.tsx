"use client"

import { useState } from "react"
import { ChevronDownIcon } from "@/components/ui/icons"

import { Button } from "@/components/ui/button"

// How many buttons show before "N more".
const FIRST = 6

// Quick answers under a reply: a tap sends one. Long lists show the first
// few and one button that shows the rest.
export function QuickChoices({
  choices,
  onPick,
  moreLabel,
}: {
  choices: string[]
  onPick: (choice: string) => void
  moreLabel: (n: number) => string
}) {
  const [all, setAll] = useState(false)
  const hidden = all ? 0 : Math.max(0, choices.length - FIRST)
  const shown = hidden > 0 ? choices.slice(0, FIRST) : choices

  return (
    <div className="flex flex-wrap gap-2">
      {shown.map((choice) => (
        <Button key={choice} variant="outline" onClick={() => onPick(choice)}>
          {choice}
        </Button>
      ))}
      {hidden > 0 && (
        <Button variant="ghost" onClick={() => setAll(true)}>
          {moreLabel(hidden)}
          <ChevronDownIcon data-icon="inline-end" />
        </Button>
      )}
    </div>
  )
}
