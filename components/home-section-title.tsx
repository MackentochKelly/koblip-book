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
  faq: "faq",
} as const
