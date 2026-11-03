import { expect, test } from "vitest"

import { welcomeDefaults } from "./automation-defaults"
import { flowGraph } from "./flow-graph"

const labels = {
  trigger: "A customer writes for the first time",
  steps: {
    customerWrites: "Customer writes",
    sendMessage: "Send message",
    bookingLink: "Send booking link",
    servicesList: "Send services",
    serviceLink: "Send service link",
    notify: "Notify you",
    reply: "Send reply",
  },
  bookingLink: "Opens your booking page",
  serviceLink: "Opens your services page",
  notify: "Tells you, then stays quiet",
  actions: { bookingLink: "Booking", servicesList: "Services", handoff: "Handoff" },
}

test("draws the trigger, the message and what each button does", () => {
  const { steps, links } = flowGraph(welcomeDefaults(), "en", "Davida Salon", labels)
  expect(steps.map((step) => step.title)).toEqual([
    "Customer writes",
    "Send message",
    "Send booking link",
    "Send services",
    "Send service link",
    "Notify you",
    "Send reply",
  ])
  expect(steps[1].summary).toContain("Thanks for writing to Davida Salon!")
  expect(steps[1].outputs?.map((output) => output.label)).toEqual(["Book now", "Our services", "Talk to us"])
  expect(links).toContainEqual({ from: "message", output: "welcome-handoff", to: "welcome-handoff:1" })
  expect(links).toContainEqual({ from: "welcome-handoff:1", to: "welcome-handoff:2" })
  // Every line ends on a step that exists.
  for (const link of links) expect(steps.some((step) => step.id === link.to)).toBe(true)
})

test("a removed button takes its steps with it, and an unnamed one reads as what it does", () => {
  const flow = welcomeDefaults()
  const buttons = [{ ...flow.buttons[0], label: { en: "", es: "" } }]
  const { steps } = flowGraph({ ...flow, buttons }, "en", "Davida Salon", labels)
  expect(steps).toHaveLength(3)
  expect(steps[1].outputs).toEqual([{ id: "welcome-booking", label: "Booking" }])
})
