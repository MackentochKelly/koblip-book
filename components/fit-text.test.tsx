import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, test, vi } from "vitest"

import { FitText } from "./fit-text"

let watchers: ResizeObserverCallback[] = []
const resized = () =>
  watchers.forEach((watcher) => watcher([], {} as ResizeObserver))
// The box's width, and the number's own width.
let room = 200
const natural = 150

beforeEach(() => {
  room = 200
  watchers = []
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
    () => room
  )
  vi.spyOn(Element.prototype, "scrollWidth", "get").mockReturnValue(natural)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const number = () => screen.getByText("12.450")

test("a number that fits keeps its own size", () => {
  render(
    <div>
      <FitText>12.450</FitText>
    </div>
  )
  expect(number().style.zoom).toBe("")
})

test("a number too long for its box shrinks just enough to fit", () => {
  room = 100
  render(
    <div>
      <FitText>12.450</FitText>
    </div>
  )
  expect(number().style.zoom).toBe("0.66")
})

test("it grows back when its box gets wider", () => {
  room = 100
  render(
    <div>
      <FitText>12.450</FitText>
    </div>
  )
  room = 200
  resized()
  expect(number().style.zoom).toBe("")
})
