import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, expect, test, vi } from "vitest"

import { WithWords } from "@/i18n/testing"

const { actions, toast } = vi.hoisted(() => ({
  actions: { saveMessageWording: vi.fn(), submitMessageToMeta: vi.fn() },
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))
vi.mock("sonner", () => ({ toast }))
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }))
vi.mock("../api/notification-actions", () => actions)

const { BusinessMessageEditor } = await import("./business-message-editor")
const { defaultButtons, defaultWording, exampleValues } = await import("../utils/booking-templates")
const { CAPTURED_BOOK_WORDS: words } = await import("../api/message-words.captured")
type Message = import("../types/notifications").NotificationMessage

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const text = (language: "en" | "es", review: Message["texts"]["en"]["review"]) => ({
  wording: defaultWording("reminder", words[language]),
  buttons: defaultButtons("reminder", words[language]),
  isDefault: false,
  review,
  reason: null,
  approved: null,
})

const reminder = (review: Message["texts"]["en"]["review"]): Message => ({
  message: "reminder",
  on: true,
  editable: true,
  // Portuguese and French as Book shows them before Google's words come: English.
  texts: { en: text("en", review), es: text("es", review), pt: text("en", review), fr: text("en", review) },
})

const examples = {
  en: exampleValues(words.en),
  es: exampleValues(words.es),
  pt: exampleValues(words.en),
  fr: exampleValues(words.en),
}

const limits = { maxHeader: 60, maxBody: 1024, maxFooter: 60, maxButtons: 3, maxButtonLabel: 20 }

function open(item: Message, onClose = vi.fn()) {
  render(
    <WithWords>
      <BusinessMessageEditor businessId="b1" item={item} limits={limits} examples={examples} onClose={onClose} />
    </WithWords>
  )
  return onClose
}

test("inserts a field in the owner's words and saves it as Book's", async () => {
  actions.saveMessageWording.mockResolvedValue({ ok: true })
  open(reminder("approved"))
  const body = screen.getByLabelText("Text") as HTMLTextAreaElement
  expect(screen.getByRole("button", { name: "Save" })).toHaveProperty("disabled", true)

  // The staff field reads "{staff}" to the owner and "{teamMember}" to Book.
  fireEvent.change(body, { target: { value: `${body.value} See you.` } })
  fireEvent.click(screen.getByRole("button", { name: "staff" }))
  expect(body.value).toContain("{staff}")
  fireEvent.click(screen.getByRole("button", { name: "Save" }))

  await waitFor(() => expect(actions.saveMessageWording).toHaveBeenCalledOnce())
  const [businessId, message, language, wording] = actions.saveMessageWording.mock.calls[0]
  expect([businessId, message, language]).toEqual(["b1", "reminder", "en"])
  expect(wording.body).toContain("{name}")
  expect(wording.body).toContain("{teamMember}")
  expect(wording.body).not.toContain("{staff}")
  expect(toast.success).toHaveBeenCalled()
})

test("a refused save shows the problem under the text", async () => {
  actions.saveMessageWording.mockResolvedValue({ ok: false, error: "empty" })
  open(reminder("approved"))
  const body = screen.getByLabelText("Text")
  fireEvent.change(body, { target: { value: "Changed" } })
  fireEvent.click(screen.getByRole("button", { name: "Save" }))
  expect(await screen.findByText(/./, { selector: "#message-problem" })).toBeTruthy()
  expect(toast.success).not.toHaveBeenCalled()
})

test("Submit to Meta shows Meta's own reason when it refuses", async () => {
  actions.submitMessageToMeta.mockResolvedValue({ ok: false, error: "chat", reason: "Too promotional" })
  open(reminder("draft"))
  fireEvent.click(screen.getByRole("tab", { name: "After 24h" }))
  fireEvent.click(screen.getByRole("button", { name: "Submit to Meta" }))
  expect(await screen.findByText("Too promotional")).toBeTruthy()
  expect(actions.submitMessageToMeta).toHaveBeenCalledWith("b1", "reminder", "en")
})

test("Reset brings back Book's wording and closes", async () => {
  actions.saveMessageWording.mockResolvedValue({ ok: true })
  const onClose = open(reminder("approved"))
  fireEvent.click(screen.getByRole("button", { name: "Reset" }))
  await waitFor(() => expect(onClose).toHaveBeenCalled())
  expect(actions.saveMessageWording).toHaveBeenCalledWith("b1", "reminder", "en", null, null)
})
