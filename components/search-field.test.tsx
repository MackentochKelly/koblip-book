import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, test } from "vitest"

import { SearchField } from "./search-field"

afterEach(cleanup)

test("a tap on the box around the input types in it", () => {
  render(<SearchField aria-label="Search" />)
  const input = screen.getByRole("searchbox", { name: "Search" })
  fireEvent.click(input.closest("[data-slot=input-group]")!)
  expect(document.activeElement).toBe(input)
})

test("a tap inside the input leaves it be", () => {
  render(<SearchField aria-label="Search" defaultValue="Ana" />)
  const input = screen.getByRole<HTMLInputElement>("searchbox")
  input.focus()
  input.setSelectionRange(1, 1)
  fireEvent.click(input)
  expect(document.activeElement).toBe(input)
  expect(input.selectionStart).toBe(1)
})
