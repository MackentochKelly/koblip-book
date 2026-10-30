import { Separator } from "@/components/ui/separator"

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
  action: "see-it-in-action",
  faq: "faq",
} as const

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
