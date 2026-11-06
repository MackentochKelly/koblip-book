import { expect, test } from "vitest"

import {
  PLAN_FEATURE_GROUPS,
  PLAN_FEATURES,
  PLANS,
} from "@/lib/plan-features"
import words from "./en"

// Admin → Plans names every plan, group and feature in lib/plan-features.ts.
test("every plan, group and feature has its words", () => {
  expect(Object.keys(words.plans.plans).sort()).toEqual([...PLANS].sort())
  expect(Object.keys(words.plans.groups).sort()).toEqual(
    [...PLAN_FEATURE_GROUPS].sort()
  )
  expect(Object.keys(words.plans.features).sort()).toEqual(
    Object.keys(PLAN_FEATURES).sort()
  )
})
