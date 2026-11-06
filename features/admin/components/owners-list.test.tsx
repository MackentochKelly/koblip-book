import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, expect, test, vi } from "vitest"
import { WithWords } from "@/i18n/testing"
import { OwnersList } from "./owners-list"

vi.mock("./admin-delete-button", () => ({ AdminDeleteButton: () => null }))
vi.mock("./owner-block-button", () => ({ OwnerBlockButton: () => null }))
afterEach(cleanup)

const OWNER = {
  id: "u1",
  name: "Owner",
  email: "o@x.com",
  image: null,
  banned: false,
  createdAt: "2026-11-01T00:00:00.000Z",
  businesses: 1,
}

test("admin shows the account voice name", () => {
  render(
    <WithWords>
      <OwnersList
        owners={[{ ...OWNER, voice: { voiceId: "v1", name: "Ana" } }]}
        selfId="u1"
        onDelete={async () => ({ ok: true })}
      />
    </WithWords>
  )
  expect(screen.getByText("Voice: Ana").title).toBe("v1")
})

test("a missing choice and a removed voice remain visible", () => {
  render(
    <WithWords>
      <OwnersList
        owners={[
          { ...OWNER, voice: null },
          { ...OWNER, id: "u2", voice: { voiceId: "removed-voice", name: null } },
        ]}
        selfId="u1"
        onDelete={async () => ({ ok: true })}
      />
    </WithWords>
  )
  expect(screen.getByText("Voice: None chosen")).toBeDefined()
  expect(screen.getByText("Voice: removed-voice")).toBeDefined()
})
