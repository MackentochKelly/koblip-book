import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

// The title of a home page section ("How it works", "What you get", …).
export const homeSectionTitleClassName =
  "font-display text-2xl font-medium tracking-tight"

// The home page's search box, which the last call to action takes you
// back to: the one search on the page, no copy of it. Here, not in the
// client HomeCta, so the server page reads the real value.
export const GET_STARTED_ID = "get-started"

// The home sections, by id, for links to them.
export const HOME_SECTION_IDS = {
  howItWorks: "how-it-works",
  features: "features",
  everything: "everything",
  action: "see-it-in-action",
  pricing: "pricing",
  faq: "faq",
} as const

// A bigger centred title, the end in the hero's serif, with a line under it:
// for a section that sells, not a row of examples. `beside`: next to its
// section's content on computers, so it lines up on the left there.
export function HomeBigTitle({
  start,
  end,
  line,
  beside = false,
}: {
  start: string
  end: string
  line: string
  beside?: boolean
}) {
  return (
    <div
      className={cn(
        "mb-4 flex flex-col items-center gap-2 px-2 text-center",
        beside && "md:items-start md:text-left"
      )}
    >
      <h2 className="font-display text-3xl font-medium tracking-tight text-balance sm:text-4xl">
        {start}{" "}
        <span className="font-serif font-normal tracking-normal italic">
          {end}
        </span>
      </h2>
      <p className="text-balance text-muted-foreground">{line}</p>
    </div>
  )
}

// The small label over a quiet home row ("Works with", "Made for"): small
// capitals with a thin line on each side, so it reads as a label.
export function HomeRowLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex w-full max-w-sm items-center gap-4 px-4">
      <Separator className="flex-1" />
      <p className="shrink-0 text-xs font-medium tracking-widest text-muted-foreground uppercase">
        {children}
      </p>
      <Separator className="flex-1" />
    </div>
  )
}
