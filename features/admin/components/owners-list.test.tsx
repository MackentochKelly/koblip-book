import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, expect, test, vi } from "vitest"
import { adminMessagesFor } from "../i18n"
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

test.each(["en", "es"] as const)(
  "admin shows the account voice name in %s",
  (language) => {
    const m = adminMessagesFor(language)
    render(
      <OwnersList
        owners={[{ ...OWNER, voice: { voiceId: "v1", name: "Ana" } }]}
        selfId="u1"
        m={m}
        onDelete={async () => ({ ok: true })}
      />
    )
    expect(screen.getByText(`${m.owners.voice}: Ana`).title).toBe("v1")
  }
)

test("a missing choice and a removed voice remain visible", () => {
  const m = adminMessagesFor("en")
  render(
    <OwnersList
      owners={[
        { ...OWNER, voice: null },
        { ...OWNER, id: "u2", voice: { voiceId: "removed-voice", name: null } },
      ]}
      selfId="u1"
      m={m}
      onDelete={async () => ({ ok: true })}
    />
  )
  expect(
    screen.getByText(`${m.owners.voice}: ${m.owners.noVoice}`)
  ).toBeDefined()
  expect(screen.getByText(`${m.owners.voice}: removed-voice`)).toBeDefined()
})
