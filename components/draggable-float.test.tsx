import { act, cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, test, vi } from "vitest"

import { DraggableFloat } from "./draggable-float"

// Every watcher on the page; motion keeps its own too.
let watchers: ResizeObserverCallback[] = []
const resized = () =>
  watchers.forEach((watcher) => watcher([], {} as ResizeObserver))
let width = 1000
let saved: string | null = null

beforeEach(() => {
  width = 1000
  saved = null
  watchers = []
  vi.stubGlobal("localStorage", { getItem: () => saved, setItem: vi.fn() })
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: ResizeObserverCallback) {
        watchers.push(callback)
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  )
  vi.spyOn(Element.prototype, "clientWidth", "get").mockImplementation(
    () => width
  )
  vi.spyOn(Element.prototype, "clientHeight", "get").mockReturnValue(800)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const place = () =>
  screen.getByText("Open").parentElement?.style.transform ?? ""

test("a button kept on the left stays in that corner when the window changes size", async () => {
  saved = JSON.stringify({ side: "left", edge: "bottom" })
  render(
    <DraggableFloat id="test">
      <span>Open</span>
    </DraggableFloat>
  )
  await vi.waitFor(() => expect(place()).toContain("-1000px"))
  width = 700
  act(() => resized())
  await vi.waitFor(() => expect(place()).toContain("-700px"))
})

test("a button never moved stays at the bottom right", () => {
  render(
    <DraggableFloat id="test">
      <span>Open</span>
    </DraggableFloat>
  )
  act(() => resized())
  expect(place()).not.toContain("px")
})

test("the button says its corner, so what rests beside it stays on the screen", async () => {
  saved = JSON.stringify({ side: "left", edge: "top" })
  render(
    <DraggableFloat id="test" attached={<span>Idea</span>}>
      <span>Open</span>
    </DraggableFloat>
  )
  screen.getByText("Idea")
  const button = screen.getByText("Open").parentElement
  await vi.waitFor(() => expect(button?.dataset.edge).toBe("top"))
  expect(button?.dataset.side).toBe("left")
})
