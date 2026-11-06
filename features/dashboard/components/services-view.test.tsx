import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { afterEach, beforeEach, expect, test, vi } from "vitest"

import type { OwnerServiceCategory } from "../types"

const { actions, categoryActions, toast } = vi.hoisted(() => ({
  actions: {
    createService: vi.fn(),
    deleteService: vi.fn(),
    reorderServices: vi.fn(),
    suggestServices: vi.fn(),
    updateService: vi.fn(),
  },
  categoryActions: {
    createServiceCategory: vi.fn(),
    deleteServiceCategory: vi.fn(),
    findOrAddServiceCategory: vi.fn(),
    reorderServiceCategories: vi.fn(),
    updateServiceCategory: vi.fn(),
  },
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))
vi.mock("sonner", () => ({ toast }))
// A computer: panels open as dialogs.
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }))
vi.mock("../api/actions", () => actions)
vi.mock("../api/category-actions", () => categoryActions)
vi.mock("../api/addon-actions", () => ({
  createAddonGroup: vi.fn(),
  suggestAddonGroups: vi.fn(),
}))
vi.mock("../api/photo-actions", () => ({
  removeServicePhoto: vi.fn(),
  setServicePhoto: vi.fn(),
}))
vi.mock("../api/team-services", () => ({ setServiceTeam: vi.fn() }))
// The photo field is the photo upload's own to test.
vi.mock("@/components/photo-upload", () => ({ PhotoField: () => null }))
// Only the Services tab matters here.
vi.mock("./extras-view", () => ({ ExtrasView: () => null }))

const { ServicesView } = await import("./services-view")

beforeEach(() => {
  // jsdom has neither; the Services and Extras tabs use both.
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })
  Element.prototype.scrollTo = vi.fn()
  for (const action of [
    ...Object.values(actions),
    ...Object.values(categoryActions),
  ]) {
    action.mockResolvedValue({ ok: true, id: "new" })
  }
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const service = (id: string, categoryId: string | null = null) => ({
  id,
  name: id,
  description: null,
  durationMinutes: 30,
  priceMinor: null,
  photoUrl: null,
  calendarColor: null,
  categoryId,
})

const hair = { id: "c1", name: "Hair", calendarColor: null }
const nails = { id: "c2", name: "Nails", calendarColor: null }
const brows = { id: "c3", name: "Brows", calendarColor: null }

function view(
  services: ReturnType<typeof service>[],
  categories: OwnerServiceCategory[] = [],
  googleCalendar = false
) {
  return render(
    <ServicesView
      businessId="b1"
      currency="USD"
      services={services}
      categories={categories}
      team={[]}
      serviceTeams={{}}
      addonGroups={[]}
      googleCalendar={googleCalendar}
    />
  )
}

// The services the list shows, in order.
const names = () =>
  Array.from(document.querySelectorAll("[data-slot=item-title]"))
    .filter((title) => !title.closest("[role=dialog]"))
    .map((title) => title.textContent)

// Opens the Categories panel.
function openCategories() {
  fireEvent.click(screen.getByRole("button", { name: /^Categories/ }))
  return screen.getByRole("dialog", { name: "Categories" })
}

// A category's row in the Categories panel.
const categoryRow = (panel: HTMLElement, name: string) =>
  within(panel)
    .getByText(name, { selector: "label" })
    .closest("[data-slot=item]") as HTMLElement

// Opens the ⋮ menu inside `scope` (the first one there) and picks `item`.
function pick(scope: HTMLElement, item: string) {
  fireEvent.click(within(scope).getAllByRole("button", { name: "More" })[0])
  fireEvent.click(screen.getByRole("menuitem", { name: item }))
}

// The row of one service.
const row = (name: string) =>
  screen
    .getByText(name, { selector: "[data-slot=item-title]" })
    .closest("[data-slot=item]") as HTMLElement

test("with no category the list stays flat, Show more included", () => {
  view(["a", "b", "c", "d", "e", "f", "g", "h"].map((id) => service(id)))
  expect(screen.queryByText("h")).toBeNull()
  expect(screen.getByRole("button", { name: "Show 1 more" })).toBeTruthy()
})

test("with categories it is one list in their order, Other last", () => {
  view(
    [
      service("Fade", "c1"),
      service("Wax"),
      service("Gel", "c2"),
      service("Trim", "c1"),
      ...["a", "b", "c", "d", "e"].map((id) => service(id, "c2")),
    ],
    [hair, nails, brows]
  )
  // No headings or menus of their own: the categories are in their panel.
  expect(screen.queryAllByRole("heading", { level: 2 })).toEqual([])
  expect(names()).toEqual([
    "Fade",
    "Trim",
    "Gel",
    "a",
    "b",
    "c",
    "d",
    "e",
    "Wax",
  ])
  // Every service shows, no Show more.
  expect(screen.queryByRole("button", { name: /^Show/ })).toBeNull()
})

test("the Categories panel shows only the ticked ones, Other included", async () => {
  view(
    [service("Fade", "c1"), service("Wax"), service("Gel", "c2")],
    [hair, nails]
  )
  const panel = openCategories()
  const box = (name: string) => within(panel).getByRole("checkbox", { name })
  expect(
    within(panel)
      .getAllByRole("checkbox")
      .map((item) => item.getAttribute("aria-checked"))
  ).toEqual(["true", "false", "false", "false"])
  fireEvent.click(box("Nails"))
  fireEvent.click(box("Other"))
  await waitFor(() => expect(names()).toEqual(["Gel", "Wax"]))
  expect(box("All services").getAttribute("aria-checked")).toBe("false")
  // The button says how many are ticked (hidden behind the open panel).
  expect(
    screen.getByRole("button", { name: /^Categories\s*2$/, hidden: true })
  ).toBeTruthy()
  // All services shows every one again.
  fireEvent.click(box("All services"))
  await waitFor(() => expect(names()).toEqual(["Fade", "Gel", "Wax"]))
  expect(box("Nails").getAttribute("aria-checked")).toBe("false")
})

test("only empty categories ticked: nothing here, All services back", async () => {
  view([service("Fade", "c1")], [hair, brows])
  const panel = openCategories()
  fireEvent.click(within(panel).getByRole("checkbox", { name: "Brows" }))
  fireEvent.click(within(panel).getByRole("button", { name: "Close" }))
  expect(await screen.findByText("No services here")).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "All services" }))
  await waitFor(() => expect(names()).toEqual(["Fade"]))
})

test("without categories the panel offers to add one", () => {
  view([service("Fade"), service("Wax")])
  const panel = openCategories()
  expect(within(panel).getByText("No categories yet")).toBeTruthy()
  expect(within(panel).queryByRole("checkbox")).toBeNull()
  expect(
    within(panel).getByRole("button", { name: "Add category" })
  ).toBeTruthy()
})

test("a service moves inside its group, with every id sent", async () => {
  view([service("Fade", "c1"), service("Wax"), service("Trim", "c1")], [hair])
  pick(row("Fade"), "Move down")
  await waitFor(() =>
    expect(actions.reorderServices).toHaveBeenCalledWith("b1", [
      "Trim",
      "Fade",
      "Wax",
    ])
  )
})

test("a category moves with every category id", async () => {
  view([service("Fade", "c1")], [hair, nails, brows])
  pick(categoryRow(openCategories(), "Hair"), "Move down")
  await waitFor(() =>
    expect(categoryActions.reorderServiceCategories).toHaveBeenCalledWith(
      "b1",
      ["c2", "c1", "c3"]
    )
  )
})

test("removing a category says its services move to Other", async () => {
  view([service("Fade", "c1")], [hair])
  pick(categoryRow(openCategories(), "Hair"), "Remove")
  const dialog = screen.getByRole("alertdialog")
  expect(within(dialog).getByText("Its services move to Other.")).toBeTruthy()
  fireEvent.click(within(dialog).getByRole("button", { name: "Remove" }))
  await waitFor(() =>
    expect(toast.success).toHaveBeenCalledWith("Category removed")
  )
  expect(categoryActions.deleteServiceCategory).toHaveBeenCalledWith("b1", "c1")
})

test("a service added from a category starts in it", async () => {
  view([service("Fade", "c1")], [hair, brows])
  pick(categoryRow(openCategories(), "Brows"), "Add a service")
  const dialog = await screen.findByRole("dialog", { name: "Add a service" })
  expect(
    within(dialog).getByRole("combobox", { name: "Category" }).textContent
  ).toContain("Brows")
  fireEvent.change(within(dialog).getByLabelText("Name"), {
    target: { value: "Tint" },
  })
  fireEvent.click(within(dialog).getByRole("button", { name: "Save" }))
  await waitFor(() =>
    expect(actions.createService).toHaveBeenCalledWith(
      "b1",
      expect.objectContaining({ name: "Tint", categoryId: "c3" })
    )
  )
})

test("editing a service starts on its own category", () => {
  view([service("Fade", "c1")], [hair, brows])
  fireEvent.click(within(row("Fade")).getByRole("button", { name: "Edit" }))
  const dialog = screen.getByRole("dialog")
  expect(
    within(dialog).getByRole("combobox", { name: "Category" }).textContent
  ).toContain("Hair")
  expect(within(dialog).getByRole("button", { name: "Save" })).toHaveProperty(
    "disabled",
    true
  )
})

test("without categories the service form has no Category field", async () => {
  view([service("Fade")])
  fireEvent.click(screen.getByRole("button", { name: "Add" }))
  const dialog = screen.getByRole("dialog")
  expect(
    within(dialog).queryByRole("combobox", { name: "Category" })
  ).toBeNull()
  fireEvent.change(within(dialog).getByLabelText("Name"), {
    target: { value: "Tint" },
  })
  fireEvent.click(within(dialog).getByRole("button", { name: "Save" }))
  await waitFor(() => expect(actions.createService).toHaveBeenCalled())
  expect(actions.createService.mock.calls[0][1]).not.toHaveProperty(
    "categoryId"
  )
})

test("a new category needs a name it doesn't already have", async () => {
  categoryActions.createServiceCategory.mockResolvedValue({
    ok: false,
    error: "taken",
  })
  view([service("Fade")])
  // At the Categories panel's foot; its form opens on top of it.
  fireEvent.click(
    within(openCategories()).getByRole("button", { name: "Add category" })
  )
  const dialog = screen.getByRole("dialog", { name: "Add a category" })
  fireEvent.click(within(dialog).getByRole("button", { name: "Save" }))
  expect(within(dialog).getByText("Add a name")).toBeTruthy()
  fireEvent.change(within(dialog).getByLabelText("Name"), {
    target: { value: "Hair" },
  })
  fireEvent.click(within(dialog).getByRole("button", { name: "Save" }))
  await waitFor(() =>
    expect(
      within(dialog).getByText("You already have this category")
    ).toBeTruthy()
  )
  // No colour without Google Calendar.
  expect(categoryActions.createServiceCategory).toHaveBeenCalledWith("b1", {
    name: "Hair",
  })
})

test("renaming a category waits for a change", async () => {
  view([service("Fade", "c1")], [hair])
  pick(categoryRow(openCategories(), "Hair"), "Edit")
  const dialog = screen.getByRole("dialog", { name: "Edit category" })
  const save = within(dialog).getByRole("button", { name: "Save" })
  expect(save).toHaveProperty("disabled", true)
  fireEvent.change(within(dialog).getByLabelText("Name"), {
    target: { value: "Hair and beard" },
  })
  expect(save).toHaveProperty("disabled", false)
  fireEvent.click(save)
  await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Saved"))
  expect(categoryActions.updateServiceCategory).toHaveBeenCalledWith(
    "b1",
    "c1",
    { name: "Hair and beard" }
  )
})

test("with Google Calendar a category saves its colour", async () => {
  view([service("Fade", "c1")], [hair], true)
  pick(categoryRow(openCategories(), "Hair"), "Edit")
  const dialog = screen.getByRole("dialog", { name: "Edit category" })
  const field = within(dialog).getByRole("combobox", {
    name: "Calendar colour",
  })
  expect(field.textContent).toContain("Calendar's colour")
  fireEvent.click(field)
  // A real click starts on the item (Base UI ignores one that doesn't).
  const tomato = await screen.findByRole("option", { name: "Tomato" })
  fireEvent.pointerDown(tomato, { pointerType: "mouse" })
  fireEvent.click(tomato)
  fireEvent.click(within(dialog).getByRole("button", { name: "Save" }))
  await waitFor(() =>
    expect(categoryActions.updateServiceCategory).toHaveBeenCalledWith(
      "b1",
      "c1",
      { name: "Hair", calendarColor: "11" }
    )
  )
})

test("a service with no colour of its own takes its category's", () => {
  view([service("Fade", "c1")], [{ ...hair, calendarColor: "2" }], true)
  fireEvent.click(within(row("Fade")).getByRole("button", { name: "Edit" }))
  const dialog = screen.getByRole("dialog")
  expect(
    within(dialog).getByRole("combobox", { name: "Calendar colour" })
      .textContent
  ).toContain("Category's colour")
})

test("a suggestion goes into its category, added when new", async () => {
  actions.suggestServices.mockResolvedValue({
    ok: true,
    services: [
      {
        name: "Tint",
        description: null,
        durationMinutes: 30,
        category: "Brows",
      },
      { name: "Wax", description: null, durationMinutes: 20, category: null },
    ],
  })
  categoryActions.findOrAddServiceCategory.mockResolvedValue({
    ok: true,
    id: "c9",
  })
  view([service("Fade")])
  fireEvent.click(screen.getByRole("button", { name: "Suggest" }))
  const dialog = await screen.findByRole("dialog", {
    name: "Suggested services",
  })
  expect(await within(dialog).findByText("Brows · 30 min")).toBeTruthy()
  expect(within(dialog).getByText("20 min")).toBeTruthy()
  fireEvent.click(within(dialog).getByRole("button", { name: "Add 2" }))
  await waitFor(() => expect(actions.createService).toHaveBeenCalledTimes(2))
  expect(categoryActions.findOrAddServiceCategory).toHaveBeenCalledTimes(1)
  expect(categoryActions.findOrAddServiceCategory).toHaveBeenCalledWith(
    "b1",
    "Brows"
  )
  expect(actions.createService).toHaveBeenNthCalledWith(
    1,
    "b1",
    expect.objectContaining({ name: "Tint", categoryId: "c9" })
  )
  expect(actions.createService).toHaveBeenNthCalledWith(
    2,
    "b1",
    expect.objectContaining({ name: "Wax", categoryId: null })
  )
})
