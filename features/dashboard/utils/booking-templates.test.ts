import { expect, test } from "vitest"

import {
  bookingTemplate,
  defaultWording,
  fieldsForOwner,
  fieldsFromOwner,
  withExamples,
  wordingProblem,
} from "./booking-templates"

const ok = { header: "Booking confirmed", footer: "Reply here" }

test("Book's own wording passes Meta's rules in both languages", () => {
  for (const language of ["en", "es"] as const) {
    for (const message of ["confirmed", "reminder", "changed", "cancelled", "ownerNewBooking"] as const) {
      expect(wordingProblem(message, defaultWording(message, language))).toBeNull()
    }
  }
})

test("fields become Meta's numbers in the order they appear, without gaps", () => {
  const template = bookingTemplate("confirmed", "en", {
    ...ok,
    body: "See you {date}, {name}. Your {date} visit is ready.",
  })
  expect(template.metaBody).toBe("See you {{1}}, {{2}}. Your {{1}} visit is ready.")
  expect(template.fields).toEqual(["date", "name"])
  expect(template.examples).toEqual(["Friday, May 8", "Alex"])
})

test("wording that Meta would refuse is caught first", () => {
  const body = (text: string) => wordingProblem("confirmed", { ...ok, body: text })
  expect(body("")).toBe("empty")
  expect(body("{name}, you're booked.")).toBe("fieldAtEdge")
  expect(body("You're booked, {name}.")).toBe("fieldAtEdge")
  expect(body("Hi {name} {service} is booked.")).toBe("fieldsTogether")
  expect(body("Hi {phone}, booked.")).toBe("unknownField")
  expect(body("Hi {name, booked.")).toBe("unknownField")
  expect(body("x".repeat(1025))).toBe("tooLong")
  expect(wordingProblem("confirmed", { ...ok, header: "Hi {name}", body: "Booked." })).toBe("fieldInLine")
  expect(wordingProblem("confirmed", { ...ok, footer: "Two\nlines", body: "Booked." })).toBe("lineBreak")
  // The owner's alert may use the phone; the customer's messages may not.
  expect(wordingProblem("ownerNewBooking", { ...ok, body: "Please call {phone} now." })).toBeNull()
  // Meta refuses a text that is mostly fields.
  expect(body("Hi {name}, your {service} at {business} is booked for {date} at {time}. See you then!")).toBe("fewWords")
  expect(body("Hi {name}, your {service} is booked. See you then!")).toBeNull()
})

test("the owner reads fields in their own language", () => {
  const labels = { name: "nombre", service: "servicio", business: "negocio", date: "fecha", time: "hora", phone: "telefono" }
  const shown = fieldsForOwner("Hola {name}, tu {service} el {date}.", labels)
  expect(shown).toBe("Hola {nombre}, tu {servicio} el {fecha}.")
  expect(fieldsFromOwner(shown, labels)).toBe("Hola {name}, tu {service} el {date}.")
  expect(fieldsFromOwner("Hola {Nombre} {otro}", labels)).toBe("Hola {name} {otro}")
  expect(withExamples("Hola {name}", "es")).toBe("Hola Ana")
})
