import { describe, expect, it } from "vitest"
import { STARTER_CATALOG_RULES } from "@/lib/starter-catalog-rules"
import { PORTRAIT_LOOKS, portraitLook } from "./portrait-look"

// Each look is "age, hair, detail".
const parts = PORTRAIT_LOOKS.map((look) => look.split(", "))

describe("portraitLook", () => {
  it("has room for a whole starter team", () => {
    expect(PORTRAIT_LOOKS.length).toBeGreaterThanOrEqual(STARTER_CATALOG_RULES.teamSize)
  })

  it("gives every look its own age, hair and detail", () => {
    for (let field = 0; field < 3; field++) {
      const values = parts.map((look) => look[field])
      expect(new Set(values).size).toBe(PORTRAIT_LOOKS.length)
    }
  })

  it("gives a starter team different looks", () => {
    const team = Array.from({ length: STARTER_CATALOG_RULES.teamSize }, (_, position) =>
      portraitLook(position)
    )
    expect(new Set(team).size).toBe(team.length)
  })

  it("wraps around for later places", () => {
    expect(portraitLook(PORTRAIT_LOOKS.length)).toBe(portraitLook(0))
  })
})
