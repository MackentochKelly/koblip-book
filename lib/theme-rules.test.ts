import { expect, test } from "vitest"

import { DEFAULT_THEME, isAvailableTheme, THEMES } from "./theme-rules"

test("Luma stays the default and Nova can be turned on", () => {
  expect(DEFAULT_THEME).toBe("luma")
  expect(isAvailableTheme("luma")).toBe(true)
  expect(isAvailableTheme("nova")).toBe(true)
})

test("a theme that is not built, or not a theme, cannot be turned on", () => {
  const unbuilt = THEMES.filter((theme) => !theme.available)
  for (const theme of unbuilt) {
    expect(isAvailableTheme(theme.id)).toBe(false)
  }
  expect(isAvailableTheme("sales")).toBe(false)
  expect(isAvailableTheme("")).toBe(false)
})
