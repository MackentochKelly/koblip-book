import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/meta-ai", () => ({ getMetaAiClient: () => null, META_IMAGE_MODEL: "m" }))
vi.mock("@/lib/uploads", () => ({ savePhoto: vi.fn() }))

import { portraitLook } from "../utils/portrait-look"
import { portraitPrompt } from "./draw-portrait"

const base = { description: null, category: "Beauty salon" }

describe("portraitPrompt", () => {
  it("draws teammates with the same kind of name as different people", () => {
    const maria = portraitPrompt({ ...base, name: "Maria", position: 0 })
    const carolina = portraitPrompt({ ...base, name: "Carolina", position: 2 })
    expect(maria).toContain(portraitLook(0))
    expect(carolina).toContain(portraitLook(2))
    expect(maria.replace("Maria", "")).not.toBe(carolina.replace("Carolina", ""))
  })

  it("dresses and places them for the business", () => {
    const text = portraitPrompt({ ...base, name: "Luis", position: 1 })
    expect(text).toContain("wear to work at a beauty salon")
    expect(text).toContain("blurred beauty salon behind")
  })
})
