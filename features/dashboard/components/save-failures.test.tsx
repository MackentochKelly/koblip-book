import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, beforeEach, expect, test, vi } from "vitest"

const { actions, toast } = vi.hoisted(() => ({
  actions: {
    saveHours: vi.fn(),
    confirmBusinessDetails: vi.fn(),
    updateBusinessDetails: vi.fn(),
  },
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))
vi.mock("sonner", () => ({ toast }))
vi.mock("../api/actions", () => actions)

const { HoursForm } = await import("./hours-form")
const { ConfirmDetailsCard } = await import("./confirm-details-card")
const { DetailsForm } = await import("./details-form")

const details = {
  name: "Barbarock",
  address: null,
  description: null,
  phone: null,
  website: null,
  seats: 1,
}

beforeEach(() => {
  for (const action of Object.values(actions)) {
    action.mockRejectedValue(new Error("offline"))
  }
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

// A save the server never answers shows a message instead of breaking the
// screen.
test("hours: a save with no answer says try again", async () => {
  render(<HoursForm businessId="b1" hours={[]} />)
  fireEvent.click(screen.getByRole("button", { name: "Save" }))
  await waitFor(() =>
    expect(toast.error).toHaveBeenCalledWith(
      "That did not work. Please try again."
    )
  )
})

test("hours: a refused save still says check the times", async () => {
  actions.saveHours.mockResolvedValue({ ok: false, error: "invalid" })
  render(<HoursForm businessId="b1" hours={[]} />)
  fireEvent.click(screen.getByRole("button", { name: "Save" }))
  await waitFor(() =>
    expect(toast.error).toHaveBeenCalledWith("Could not save. Check the times.")
  )
})

test("confirm details: a save with no answer says it could not confirm", async () => {
  render(
    <ConfirmDetailsCard
      businessId="b1"
      details={{ category: null, phone: null, website: null, openDays: 0 }}
    />
  )
  fireEvent.click(screen.getByRole("button", { name: "Looks right" }))
  await waitFor(() =>
    expect(toast.error).toHaveBeenCalledWith("Could not confirm. Try again.")
  )
})

test("details: a save with no answer says try again", async () => {
  render(<DetailsForm businessId="b1" details={details} hasTeam={false} />)
  fireEvent.click(screen.getByRole("button", { name: "Save" }))
  await waitFor(() =>
    expect(toast.error).toHaveBeenCalledWith(
      "That did not work. Please try again."
    )
  )
})
