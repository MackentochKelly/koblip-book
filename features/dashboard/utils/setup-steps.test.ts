import { describe, expect, it } from "vitest"

import type { ChatConnection } from "../types/chat-connection"
import type { NotificationMessage, NotificationText, TemplateReview } from "../types/notifications"
import { setupSteps } from "./setup-steps"

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
  { on = true, isDefault = true } = {}
): NotificationMessage {
  return {
    message: name,
    on,
    editable: true,
    texts: { en: text(review, isDefault), es: text(review, isDefault) },
  }
}

describe("setupSteps", () => {
  it("is nothing without a usable connection with a number", () => {
    const messages = [message("reminder", "approved")]
    expect(setupSteps(null, messages).connected).toBe(false)
    expect(setupSteps({ ...connection, needsReconnect: true }, messages).connected).toBe(false)
    expect(setupSteps({ ...connection, messages: "noNumber" }, messages)).toEqual({
      connected: false,
      reviewed: false,
      submitted: false,
      approved: false,
      live: false,
    })
  })

  it("is not reviewed while Book's own wording was never submitted", () => {
    const steps = setupSteps(connection, [message("reminder", "draft")])
    expect(steps).toMatchObject({ connected: true, reviewed: false })
  })

  it("is reviewed once the owner saved their wording, submitted once none is a draft", () => {
    expect(setupSteps(connection, [message("reminder", "draft", { isDefault: false })])).toMatchObject({
      reviewed: true,
      submitted: false,
    })
    expect(setupSteps(connection, [message("reminder", "waiting")])).toMatchObject({
      submitted: true,
      approved: false,
    })
  })

  it("ignores turned-off messages and is live with a customer message on", () => {
    const steps = setupSteps(connection, [
      message("reminder", "approved"),
      message("changed", "draft", { on: false }),
    ])
    expect(steps).toEqual({
      connected: true,
      reviewed: true,
      submitted: true,
      approved: true,
      live: true,
    })
    expect(setupSteps(connection, [message("ownerNewBooking", "approved")]).live).toBe(false)
  })
})
