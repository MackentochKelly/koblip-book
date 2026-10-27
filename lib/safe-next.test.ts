import { expect, test } from "vitest"
import { safeNext } from "./safe-next"

test("same-site paths pass through", () => {
  expect(safeNext("/dashboard/x")).toBe("/dashboard/x")
  expect(safeNext("/dashboard")).toBe("/dashboard")
  expect(safeNext("/sign-in?next=%2Fdashboard")).toBe(
    "/sign-in?next=%2Fdashboard"
  )
})

test("anything else falls back to the dashboard", () => {
  expect(safeNext("//evil.com")).toBe("/dashboard")
  expect(safeNext("https://evil.com")).toBe("/dashboard")
  expect(safeNext("/\\evil")).toBe("/dashboard")
  expect(safeNext("")).toBe("/dashboard")
  expect(safeNext(null)).toBe("/dashboard")
  expect(safeNext(undefined)).toBe("/dashboard")
})
