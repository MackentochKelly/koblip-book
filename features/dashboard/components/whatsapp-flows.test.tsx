import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, expect, test, vi } from "vitest"

const { actions, toast } = vi.hoisted(() => ({
  actions: { setAutomationOn: vi.fn(), saveAutomation: vi.fn() },
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))
vi.mock("sonner", () => ({ toast }))
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }))
vi.mock("../api/automation-actions", () => actions)

const { WhatsappFlows } = await import("./whatsapp-flows")
const { welcomeDefaults } = await import("../utils/automation-defaults")
type Automation = import("../types/automations").Automation

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const welcome = (on = false): Automation => ({
  id: "a1",
  trigger: "firstMessage",
  on,
  ...welcomeDefaults(),
  isDefault: true,
  updatedAt: "2026-10-31T00:00:00.000Z",
})

function show(automation: Automation, ownNumber = true) {
  render(
    <WhatsappFlows
      businessId="b1"
      businessName="Davida Salon"
      automations={[automation]}
      ownNumber={ownNumber}
      limits={{ maxBody: 1024, maxListBody: 4096, maxButtons: 3, maxButtonLabel: 20 }}
    />
  )
}

test("shows Welcome's steps: trigger, message and each button", () => {
  show(welcome())
  const steps = screen.getByRole("list", { name: "Welcome steps" })
  expect(steps.textContent).toContain("A customer writes for the first time")
  // {business} reads as the business's name.
  expect(steps.textContent).toContain("Thanks for writing to Davida Salon!")
  for (const [label, action] of [
    ["Book now", "Opens your booking page"],
    ["Our services", "Sends your services"],
    ["Talk to us", "Tells you, then stays quiet"],
  ]) {
    expect(steps.textContent).toContain(label)
    expect(steps.textContent).toContain(action)
  }
})

test("turns Welcome on", async () => {
  actions.setAutomationOn.mockResolvedValue({ ok: true })
  show(welcome())
  fireEvent.click(screen.getByRole("switch", { name: "Send welcome" }))
  await waitFor(() => expect(actions.setAutomationOn).toHaveBeenCalledWith("b1", "a1", true))
  expect(toast.error).not.toHaveBeenCalled()
})

test("without the business's own number, on is locked and the way to it shows", () => {
  show(welcome(), false)
  // Base UI's switch is a span that marks itself disabled.
  expect(screen.getByRole("switch", { name: "Send welcome" }).hasAttribute("data-disabled")).toBe(true)
  expect(screen.getByText("Works on your own number only.")).toBeTruthy()
  expect(screen.getByText("Use your own number").closest("a")?.getAttribute("href")).toBe(
    "/dashboard/b1/integrations"
  )
})

test("a refused save goes back and says why", async () => {
  actions.setAutomationOn.mockResolvedValue({ ok: false, error: "noOwnNumber" })
  show(welcome())
  const toggle = screen.getByRole("switch", { name: "Send welcome" })
  fireEvent.click(toggle)
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Works on your own number only."))
  expect(toggle.getAttribute("aria-checked")).toBe("false")
})

test("the card opens the editor; a save sends both languages", async () => {
  actions.saveAutomation.mockResolvedValue({ ok: true })
  show(welcome())
  fireEvent.click(screen.getByRole("button", { name: "Edit welcome" }))
  const save = screen.getByRole("button", { name: "Save" })
  expect(save).toHaveProperty("disabled", true)

  fireEvent.change(screen.getByPlaceholderText("Opens your booking page"), {
    target: { value: "Book" },
  })
  // Our services moves above Book now.
  fireEvent.click(screen.getByRole("button", { name: "Move Our services up" }))
  fireEvent.click(save)
  await waitFor(() => expect(actions.saveAutomation).toHaveBeenCalled())
  const [, id, input] = actions.saveAutomation.mock.calls[0]
  expect(id).toBe("a1")
  expect(input.buttons.map((button: { id: string }) => button.id)).toEqual([
    "welcome-services",
    "welcome-booking",
    "welcome-handoff",
  ])
  expect(input.buttons[1].label).toEqual({ en: "Book", es: "Reservar" })
  expect(input.wording.es.body).toContain("{business}")
})

test("a refused save shows under its field, in its language", async () => {
  actions.saveAutomation.mockResolvedValue({ ok: false, error: "empty", field: "wording.es.body" })
  show(welcome())
  fireEvent.click(screen.getByRole("button", { name: "Edit welcome" }))
  fireEvent.change(screen.getByLabelText("Text"), { target: { value: "Hi" } })
  fireEvent.click(screen.getByRole("button", { name: "Save" }))
  await waitFor(() => expect(screen.getByText("Can't be empty.")).toBeTruthy())
  // The Spanish words are open now.
  expect((screen.getByLabelText("Text") as HTMLTextAreaElement).value).toContain("Gracias")
})
