import { describe, expect, it } from "vitest"

import { serverWords } from "@/i18n/testing"
import {
  CLIENT_IN_APP_KINDS,
  IN_APP_KINDS,
  OWNER_IN_APP_KINDS,
} from "@/types/in-app-notifications"
import type { InAppNotification } from "../types/notifications"
import {
  CHOICE_GROUPS,
  CLIENT_CHOICE_GROUPS,
  groupByDay,
  mergePage,
  titleOf,
} from "./notification-view"

const t = await serverWords().getTranslations("notifications")
const title = (item: InAppNotification) => titleOf(item, t, "en-US")

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
    expect(title(note({ data: { customerName: "Ana" } }))).toBe(
      "New booking: Ana"
    )
    expect(title(note({ data: { customerPhone: "15551234567" } }))).toBe(
      "New booking: +15551234567"
    )
    expect(title(note())).toBe("New booking: A customer")
  })

  it("names the message Meta decided on", () => {
    const item = note({
      kind: "templateApproved",
      data: { message: "reminder" },
    })
    expect(title(item)).toBe("Meta approved Reminder")
    expect(
      title(note({ kind: "templateRejected", data: { message: "gone" } }))
    ).toBe("Meta rejected a message")
  })

  it("formats the usage numbers in the reader's language", () => {
    const item = note({
      kind: "koblipLimitNear",
      data: { sent: 1800, limit: 2000 },
    })
    expect(title(item)).toBe("1,800 of 2,000 messages used this month")
    expect(titleOf(item, t, "de-DE")).toBe(
      "1.800 of 2.000 messages used this month"
    )
  })

  it("names the client's visit and its time in the business's zone", () => {
    const item = note({
      kind: "clientMoved",
      data: { serviceName: "Haircut", startAt: "2026-11-07T19:30:00.000Z" },
    })
    expect(title(item)).toBe("Haircut moved to Sat, Nov 7, 2:30 PM")
  })

  it("has a title for every kind", () => {
    for (const kind of IN_APP_KINDS) {
      expect(title(note({ kind }))).not.toBe("")
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
  it("holds every owner kind exactly once", () => {
    const kinds = CHOICE_GROUPS.flatMap((group) => [...group.kinds])
    expect([...kinds].sort()).toEqual([...OWNER_IN_APP_KINDS].sort())
  })

  it("the client's hold every client kind exactly once", () => {
    const kinds = CLIENT_CHOICE_GROUPS.flatMap((group) => [...group.kinds])
    expect([...kinds].sort()).toEqual([...CLIENT_IN_APP_KINDS].sort())
  })
})
