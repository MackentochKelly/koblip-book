import { expect, test } from "vitest"
import { isBookable } from "./is-bookable"

test("open business with services and hours is bookable", () => {
  expect(
    isBookable({ status: "open", servicesCount: 2, hoursCount: 3 })
  ).toBe(true)
  expect(
    isBookable({ status: "operational", servicesCount: 1, hoursCount: 1 })
  ).toBe(true)
  expect(isBookable({ status: null, servicesCount: 1, hoursCount: 1 })).toBe(
    true
  )
})

test("closed statuses are not bookable", () => {
  expect(isBookable({ status: "closed", servicesCount: 1, hoursCount: 1 })).toBe(
    false
  )
  expect(
    isBookable({
      status: "temporarily_closed",
      servicesCount: 1,
      hoursCount: 1,
    })
  ).toBe(false)
})

test("missing services or hours are not bookable", () => {
  expect(isBookable({ status: "open", servicesCount: 0, hoursCount: 1 })).toBe(
    false
  )
  expect(isBookable({ status: "open", servicesCount: 1, hoursCount: 0 })).toBe(
    false
  )
})
