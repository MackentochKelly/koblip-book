import { expect, test } from "vitest"
import { SETUP_TASKS, setupTasks } from "./setup-tasks"

const none = {
  detailsConfirmed: false,
  openDays: 0,
  services: 0,
  team: 0,
  photos: 0,
  bookings: 0,
}

test("a new business has every step to do, each with its page", () => {
  const steps = setupTasks(none, "/dashboard/b1", "/b/shop")
  expect(steps.map((step) => step.id)).toEqual([...SETUP_TASKS])
  expect(steps.every((step) => !step.done)).toBe(true)
  expect(steps.find((step) => step.id === "services")?.href).toBe("/dashboard/b1/services")
  expect(steps.find((step) => step.id === "booking")?.href).toBe("/b/shop")
})

test("steps are done from the business's own data", () => {
  const steps = setupTasks(
    { ...none, detailsConfirmed: true, openDays: 6, services: 4, photos: 2 },
    "/dashboard/b1",
    "/b/shop"
  )
  expect(steps.filter((step) => step.done).map((step) => step.id)).toEqual([
    "details",
    "hours",
    "services",
    "photos",
  ])
})
