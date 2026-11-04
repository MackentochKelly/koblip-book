import { expect, test } from "vitest"
import {
  INITIAL_LOCATION,
  locationView,
  type LocationState,
} from "./location-state"

test.each([
  ["checking", false, true, false, "none"],
  ["prompt", false, true, true, "none"],
  ["ready", false, true, false, "none"],
  ["denied-site", false, false, true, "none"],
  ["refused", false, false, false, "off"],
  ["denied-other", false, true, false, "settings"],
  ["unsupported", false, false, true, "none"],
  ["reading", true, true, false, "none"],
  ["found", false, true, false, "none"],
  ["unanswered", false, true, false, "waiting"],
  ["timed-out", false, true, false, "timeout"],
  ["failed", false, true, false, "not-found"],
  ["city", false, true, false, "none"],
] as const)(
  "%s defines both controls, search taps and the Alert",
  (phase, busy, canLocate, openOnSearch, alert) => {
    const state: LocationState = {
      ...INITIAL_LOCATION,
      phase,
      permission: phase === "denied-site" ? "denied" : "granted",
      area:
        phase === "found"
          ? {
              isCurrentLocation: true,
              center: { latitude: 42, longitude: -71 },
            }
          : phase === "city"
            ? { label: "Brockton", center: { latitude: 42, longitude: -71 } }
            : null,
    }
    expect(locationView(state)).toMatchObject({
      busy,
      canLocate,
      openOnSearch,
      alert,
    })
  }
)

test("unavailable position never implies a settings problem; pending is not a failure", () => {
  expect(locationView({ ...INITIAL_LOCATION, phase: "failed" }).alert).toBe(
    "not-found"
  )
  expect(locationView({ ...INITIAL_LOCATION, phase: "unanswered" }).alert).toBe(
    "waiting"
  )
})

test.each(["prompt", "denied-site", "unsupported"] as const)(
  "%s: once this device has seen the panel, search runs and nothing opens by itself",
  (phase) => {
    const state = { ...INITIAL_LOCATION, phase }
    expect(locationView(state)).toMatchObject({
      openOnSearch: true,
      search: false,
    })
    expect(locationView(state, true)).toMatchObject({
      openOnSearch: false,
      search: true,
    })
  }
)

test("a picked city keeps the native location button hidden after a site refusal", () => {
  expect(
    locationView({
      ...INITIAL_LOCATION,
      phase: "city",
      permission: "denied",
      area: { label: "Brockton", center: { latitude: 42, longitude: -71 } },
    })
  ).toMatchObject({
    canLocate: false,
    busy: false,
    alert: "none",
    openOnSearch: false,
  })
})
