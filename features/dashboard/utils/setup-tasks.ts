// A new owner's first steps on the home page, in order. Each is done once
// the business's own data shows it, so nothing is ticked by hand.
export const SETUP_TASKS = [
  "details",
  "hours",
  "services",
  "team",
  "photos",
  "booking",
] as const

export type SetupTask = (typeof SETUP_TASKS)[number]

// What the business has now.
export type SetupFacts = {
  detailsConfirmed: boolean
  openDays: number
  services: number
  team: number
  photos: number
  bookings: number
}

export type SetupTaskState = { id: SetupTask; done: boolean; href: string }

// Each step with whether it is done and where to do it. `base` is the
// business's dashboard path, `pagePath` its booking page.
export function setupTasks(
  facts: SetupFacts,
  base: string,
  pagePath: string
): SetupTaskState[] {
  const steps: Record<SetupTask, Omit<SetupTaskState, "id">> = {
    details: { done: facts.detailsConfirmed, href: `${base}/settings` },
    hours: { done: facts.openDays > 0, href: `${base}/settings/hours` },
    services: { done: facts.services > 0, href: `${base}/services` },
    team: { done: facts.team > 0, href: `${base}/team` },
    photos: { done: facts.photos > 0, href: `${base}/settings/portfolio` },
    booking: { done: facts.bookings > 0, href: pagePath },
  }
  return SETUP_TASKS.map((id) => ({ id, ...steps[id] }))
}
