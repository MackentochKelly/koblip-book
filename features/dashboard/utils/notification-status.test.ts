import { describe, expect, it } from "vitest"

import type { ChatConnection } from "../types/chat-connection"
import type { NotificationMessage, NotificationText, TemplateReview } from "../types/notifications"
import { notificationStatus } from "./notification-status"

const connection: ChatConnection = {
  workspaceName: "Shop",
  needsReconnect: false,
  messages: "notSubmitted",
}

function text(review: TemplateReview, isDefault = true): NotificationText {
  return {
    wording: { header: "Hi", body: "Text", footer: "" },
    buttons: [],
    isDefault,
    review,
    reason: null,
  }
}

function message(
  name: NotificationMessage["message"],
  review: TemplateReview,
  { on = true, isDefault = true, editable = true } = {}
): NotificationMessage {
  return {
    message: name,
    on,
    editable,
    texts: { en: text(review, isDefault), es: text(review, isDefault) },
  }
}

describe("notificationStatus", () => {
  it("is live on Koblip's number with its set approved and a customer message on", () => {
    const status = notificationStatus("koblip", null, [
      message("reminder", "approved", { editable: false }),
    ])
    expect(status).toMatchObject({ state: "live", next: null })
  })

  it("waits for Meta on Koblip's number while its set is in review", () => {
    expect(
      notificationStatus("koblip", null, [message("reminder", "waiting", { editable: false })])
    ).toMatchObject({ state: "waiting", next: null })
  })

  it("asks to turn a customer message on when none is", () => {
    expect(
      notificationStatus("koblip", null, [
        message("reminder", "approved", { on: false, editable: false }),
        message("ownerNewBooking", "approved", { editable: false }),
      ])
    ).toMatchObject({ state: "action", next: "turnOn" })
  })

  it("walks the own number's steps: reconnect, number, fix, review, submit", () => {
    const reminder = [message("reminder", "draft")]
    expect(notificationStatus(null, { ...connection, needsReconnect: true }, reminder).next).toBe(
      "reconnect"
    )
    expect(notificationStatus(null, { ...connection, messages: "noNumber" }, reminder).next).toBe(
      "addNumber"
    )
    expect(notificationStatus("own", connection, [message("reminder", "rejected")]).next).toBe("fix")
    expect(notificationStatus("own", connection, reminder)).toMatchObject({
      state: "action",
      next: "review",
    })
    expect(
      notificationStatus("own", connection, [message("reminder", "draft", { isDefault: false })])
        .next
    ).toBe("submit")
  })

  it("waits once everything is submitted, and is live once approved", () => {
    expect(notificationStatus("koblip", connection, [message("reminder", "waiting")])).toMatchObject({
      state: "waiting",
      next: null,
    })
    expect(notificationStatus("own", connection, [message("reminder", "approved")])).toMatchObject({
      state: "live",
      next: null,
      steps: { live: true },
    })
  })
})
