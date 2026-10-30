import { expect, test } from "vitest"

import {
  BOOKING_MESSAGES,
  TEMPLATE_LANGUAGES,
  bookingTemplate,
  bookingValues,
  buttonsProblem,
  defaultButtons,
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
  const labels = {
    name: "nombre",
    service: "servicio",
    business: "negocio",
    date: "fecha",
    time: "hora",
    teamMember: "profesional",
    duration: "duracion",
    price: "precio",
    address: "direccion",
    phone: "telefono",
  }
  const shown = fieldsForOwner("Hola {name}, tu {service} el {date}.", labels)
  expect(shown).toBe("Hola {nombre}, tu {servicio} el {fecha}.")
  expect(fieldsFromOwner(shown, labels)).toBe("Hola {name}, tu {service} el {date}.")
  expect(fieldsFromOwner("Hola {Nombre} {otro}", labels)).toBe("Hola {name} {otro}")
  expect(withExamples("Hola {name}", "es")).toBe("Hola Ana")
})

test("Book's own buttons pass WhatsApp's rules, and reminders can be answered", () => {
  for (const language of TEMPLATE_LANGUAGES) {
    for (const message of BOOKING_MESSAGES) {
      expect(buttonsProblem(message, defaultButtons(message, language))).toBeNull()
    }
  }
  expect(defaultButtons("reminder", "en").map(({ action }) => action)).toEqual(["confirm", "cantCome"])
  expect(bookingTemplate("reminder", "es").buttons).toEqual(defaultButtons("reminder", "es"))
})

test("buttons that WhatsApp would refuse are caught first", () => {
  const button = (action: "confirm" | "cantCome" | "ok", label: string) => ({ action, label })
  expect(
    buttonsProblem("reminder", [
      button("confirm", "Yes"),
      button("cantCome", "No"),
      button("ok", "OK"),
      button("ok", "Fine"),
    ])
  ).toBe("tooManyButtons")
  expect(buttonsProblem("reminder", [button("confirm", "Yes ✅")])).toBe("badButton")
  expect(buttonsProblem("reminder", [button("confirm", "*Yes*")])).toBe("badButton")
  expect(buttonsProblem("reminder", [button("confirm", "x".repeat(26))])).toBe("badButton")
  expect(buttonsProblem("cancelled", [button("confirm", "Yes")])).toBe("badButton")
  expect(buttonsProblem("ownerNewBooking", [button("ok", "OK")])).toBe("badButton")
  expect(buttonsProblem("reminder", [button("confirm", "Yes"), button("cantCome", "yes")])).toBe("sameButton")
  expect(buttonsProblem("reminder", [button("confirm", "Yes"), button("confirm", "Sure")])).toBe("sameButton")
})

test("every field has a value the customer can read, even when the booking lacks it", () => {
  const facts = {
    customerName: "Ana",
    customerPhone: null,
    serviceName: "Corte",
    teamMemberName: "Lucía",
    durationMinutes: 90,
    priceMinor: 3500,
    currency: "USD",
    businessName: "Lumen Studio",
    businessAddress: "Calle Mayor 12",
    date: "2026-05-08",
    time: "15:30",
  }
  const values = bookingValues(facts, "en")
  expect(values.teamMember).toBe("Lucía")
  expect(values.duration).toBe("1 h 30 min")
  expect(values.price).toBe("$35.00")
  expect(values.address).toBe("Calle Mayor 12")
  expect(values.phone).toBe("-")
  const bare = bookingValues(
    { ...facts, teamMemberName: null, priceMinor: null, businessAddress: " " },
    "es"
  )
  expect(bare.teamMember).toBe("nuestro equipo")
  expect(bare.price).toBe("por confirmar")
  expect(bare.address).toBe("Lumen Studio")
  expect(bookingValues({ ...facts, priceMinor: 0 }, "en").price).toBe("free")
})

test("the new fields fit the customer's messages and the owner's alert", () => {
  const ok = { header: "Booked", footer: "" }
  expect(
    wordingProblem("confirmed", { ...ok, body: "Hi {name}, your visit with {teamMember} takes about {duration} and costs {price}. Please come to {address} a few minutes early, thank you." })
  ).toBeNull()
  expect(wordingProblem("ownerNewBooking", { ...ok, body: "New booking with {teamMember} for {duration} at the shop today." })).toBeNull()
  expect(wordingProblem("ownerNewBooking", { ...ok, body: "New booking near {address} for the shop today." })).toBe("unknownField")
  expect(withExamples("With {teamMember} for {duration}", "en")).toBe("With Sam for 45 min")
})
