import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, expect, test, vi } from "vitest"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }))

const { MessageEditor } = await import("./message-editor")
type Item = import("./message-editor").MessageEditorItem

afterEach(cleanup)

const t = {
  normalMessage: "Normal message",
  normalHint: "Inside 24 hours",
  template: "Template",
  templateHint: "Outside 24 hours",
  approvedNow: "Sending now",
}
const labels: import("./message-editor").MessageEditorLabels = {
  ...t,
  edit: (name) => `Edit ${name}`,
  english: "English",
  spanish: "Spanish",
  metaReason: "Meta's reason",
  review: { missing: "Draft", draft: "Draft", waiting: "In review", approved: "Approved", rejected: "Rejected" },
  readOnly: "Read-only",
  title: "Title",
  text: "Text",
  footer: "Footer",
  buttons: "Buttons",
  buttonKinds: { confirm: "Confirms", cantCome: "Can't come", ok: "OK" },
  addButton: "Add button",
  removeButton: (label) => `Remove ${label}`,
  reset: "Reset",
  save: "Save",
  submit: "Submit to Meta",
  saved: "Saved",
  submitted: "Submitted",
  failed: "Failed",
}
const limits = { maxHeader: 60, maxBody: 1024, maxFooter: 60, maxButtons: 3, maxButtonLabel: 20 }

const saved = {
  wording: { header: "Reminder", body: "See you {name} tomorrow", footer: "" },
  buttons: [],
}
const item = (approved: Item["texts"]["en"]["approved"]): Item => {
  const text = { ...saved, isDefault: false, review: "approved" as const, reason: null, approved }
  return {
    name: "Reminder",
    editable: true,
    fields: ["name"],
    buttonActions: [],
    texts: { en: text, es: text },
  }
}

function open(value: Item) {
  render(
    <MessageEditor
      item={value}
      labels={labels}
      limits={limits}
      preview={(body) => body.replace("{name}", "Ana")}
      onSave={vi.fn()}
      onSubmit={vi.fn()}
      onClose={vi.fn()}
    />
  )
}

test("shows the normal message and the template apart", () => {
  open(item(saved))
  expect(screen.getByText(t.normalMessage)).toBeTruthy()
  expect(screen.getByText(t.normalHint)).toBeTruthy()
  expect(screen.getByText(t.template)).toBeTruthy()
  expect(screen.getByText(t.templateHint)).toBeTruthy()
  // Same words as approved: one preview, no "sending now" line.
  expect(screen.getAllByText("See you Ana tomorrow")).toHaveLength(1)
  expect(screen.queryByText(t.approvedNow)).toBeNull()
})

test("while a change waits for Meta, the template shows the approved words", () => {
  open(item({ ...saved, wording: { ...saved.wording, body: "Bye {name}" } }))
  expect(screen.getByText("See you Ana tomorrow")).toBeTruthy()
  expect(screen.getByText("Bye Ana")).toBeTruthy()
  expect(screen.getByText(t.approvedNow)).toBeTruthy()
})
