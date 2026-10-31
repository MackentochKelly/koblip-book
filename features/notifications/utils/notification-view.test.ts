import { describe, expect, it } from "vitest"

import { IN_APP_KINDS } from "@/types/in-app-notifications"
import { notificationMessagesFor } from "../i18n"
import type { InAppNotification } from "../types/notifications"
import {
  CHOICE_GROUPS,
  groupByDay,
  mergePage,
  titleOf,
} from "./notification-view"

const en = notificationMessagesFor("en")
const es = notificationMessagesFor("es")

function note(overrides: Partial<InAppNotification> = {}): InAppNotification {
  return {
    id: "n1",
    kind: "newBooking",
    businessId: "b1",
    businessName: "Studio",
    timezone: "America/New_York",
    data: {},
    link: "/dashboard/b1",
    read: false,
    at: new Date(2026, 9, 30, 10).toISOString(),
    ...overrides,
  }
}

describe("titleOf", () => {
  it("names the customer, else their number, else a customer", () => {
    expect(titleOf(note({ data: { customerName: "Ana" } }), en)).toBe(
      "New booking: Ana"
    )
    expect(titleOf(note({ data: { customerPhone: "15551234567" } }), en)).toBe(
      "New booking: +15551234567"
    )
    expect(titleOf(note(), es)).toBe("Nueva reserva: Un cliente")
  })

  it("names the message Meta decided on", () => {
    const item = note({
      kind: "templateApproved",
      data: { message: "reminder" },
    })
    expect(titleOf(item, en)).toBe("Meta approved Reminder")
    expect(titleOf(item, es)).toBe("Meta aprobó Recordatorio")
    expect(
      titleOf(note({ kind: "templateRejected", data: { message: "gone" } }), en)
    ).toBe("Meta rejected a message")
  })

  it("formats the usage numbers in the reader's language", () => {
    const item = note({
      kind: "koblipLimitNear",
      data: { sent: 1800, limit: 2000 },
    })
    expect(titleOf(item, en)).toBe("1,800 of 2,000 messages used this month")
  })

  it("has a title for every kind in both languages", () => {
    for (const kind of IN_APP_KINDS) {
      expect(titleOf(note({ kind }), en)).not.toBe("")
      expect(titleOf(note({ kind }), es)).not.toBe("")
    }
  })
})

describe("groupByDay", () => {
  it("splits today from earlier and drops an empty group", () => {
    const now = new Date(2026, 9, 30, 18).getTime()
    const today = note({ id: "a" })
    const earlier = note({
      id: "b",
      at: new Date(2026, 9, 29, 23).toISOString(),
    })
    expect(groupByDay([today, earlier], now)).toEqual([
      { id: "today", items: [today] },
      { id: "earlier", items: [earlier] },
    ])
    expect(groupByDay([earlier], now).map((group) => group.id)).toEqual([
      "earlier",
    ])
  })
})

describe("mergePage", () => {
  it("puts the fresh page first and keeps older loaded ones", () => {
    const fresh = [
      note({ id: "c", at: "2026-10-30T12:00:00.000Z" }),
      note({ id: "b", at: "2026-10-30T11:00:00.000Z" }),
    ]
    const shown = [
      note({ id: "b", at: "2026-10-30T11:00:00.000Z", read: true }),
      note({ id: "a", at: "2026-10-30T10:00:00.000Z" }),
    ]
    expect(mergePage(fresh, shown).map((item) => [item.id, item.read])).toEqual(
      [
        ["c", false],
        ["b", false],
        ["a", false],
      ]
    )
  })
})

describe("CHOICE_GROUPS", () => {
  it("holds every kind exactly once", () => {
    const kinds = CHOICE_GROUPS.flatMap((group) => [...group.kinds])
    expect([...kinds].sort()).toEqual([...IN_APP_KINDS].sort())
  })
})
