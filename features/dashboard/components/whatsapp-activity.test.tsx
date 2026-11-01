import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, expect, test, vi } from "vitest"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/dashboard/b1/automations/activity",
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("../api/notification-actions", () => ({ sendAgain: vi.fn() }))

const { WhatsappActivity } = await import("./whatsapp-activity")
type Send = import("../types/notifications").NotificationSend
type Run = import("../types/automations").AutomationRun

afterEach(cleanup)

const send = (id: string, at: string): Send =>
  ({
    id,
    message: "reminder",
    customerName: "Ana",
    at,
    state: "sent",
    reason: null,
    via: "text",
    sender: "own",
    delivery: null,
    reply: null,
  }) as Send

const run = (id: string, at: string, patch: Partial<Run> = {}): Run => ({
  id,
  automationId: "a1",
  customerPhone: "18095550100",
  customerName: "Luis",
  step: "welcome",
  state: "sent",
  reason: null,
  at,
  ...patch,
})

test("runs show among the messages, newest first, with why one didn't go", () => {
  render(
    <WhatsappActivity
      businessId="b1"
      history={[send("s1", "2026-10-31T10:00:00.000Z")]}
      runs={[
        run("r1", "2026-10-31T11:00:00.000Z"),
        run("r2", "2026-10-31T09:00:00.000Z", {
          step: "handoff",
          state: "skipped",
          reason: "paused",
        }),
      ]}
      filter={{}}
      timeZone="UTC"
    />
  )
  const titles = Array.from(document.querySelectorAll("[data-slot=item-title]")).map(
    (title) => title.textContent
  )
  expect(titles).toEqual(["Welcome", "Reminder", "Talk to us"])
  expect(screen.getByText(/Handed to you/)).toBeTruthy()
  expect(screen.getByText("Not sent")).toBeTruthy()
})

test("the message filter offers Automations", () => {
  render(
    <WhatsappActivity
      businessId="b1"
      history={[]}
      runs={[run("r1", "2026-10-31T11:00:00.000Z")]}
      filter={{ automations: true }}
      timeZone="UTC"
    />
  )
  expect(screen.getByRole("combobox", { name: "Message" }).textContent).toContain("Automations")
})
