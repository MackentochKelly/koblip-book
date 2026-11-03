import type { Coordinates } from "../types"

export type SearchArea = { center: Coordinates } & (
  | { isCurrentLocation: true; label?: never }
  | { isCurrentLocation?: false; label: string }
)

// One policy for the pill, panel button, search tap, and existing Alert.
// The pill itself always opens the panel and is never disabled.
export const LOCATION_STATES = {
  checking: {
    busy: false,
    canLocate: true,
    openOnSearch: false,
    alert: "none",
    search: false,
  },
  prompt: {
    busy: false,
    canLocate: true,
    openOnSearch: true,
    alert: "none",
    search: false,
  },
  "denied-site": {
    busy: false,
    canLocate: false,
    openOnSearch: true,
    alert: "none",
    search: false,
  },
  "denied-other": {
    busy: false,
    canLocate: true,
    openOnSearch: true,
    alert: "settings",
    search: true,
  },
  unsupported: {
    busy: false,
    canLocate: false,
    openOnSearch: true,
    alert: "none",
    search: false,
  },
  reading: {
    busy: true,
    canLocate: true,
    openOnSearch: false,
    alert: "none",
    search: true,
  },
  found: {
    busy: false,
    canLocate: true,
    openOnSearch: false,
    alert: "none",
    search: true,
  },
  unanswered: {
    busy: false,
    canLocate: true,
    openOnSearch: true,
    alert: "waiting",
    search: true,
  },
  failed: {
    busy: false,
    canLocate: true,
    openOnSearch: true,
    alert: "not-found",
    search: true,
  },
  "timed-out": {
    busy: false,
    canLocate: true,
    openOnSearch: true,
    alert: "timeout",
    search: true,
  },
  city: {
    busy: false,
    canLocate: true,
    openOnSearch: false,
    alert: "none",
    search: true,
  },
} as const

export interface LocationState {
  phase: keyof typeof LOCATION_STATES
  permission: PermissionState | "unknown"
  area: SearchArea | null
}

export type LocationAlert =
  "none" | "not-found" | "settings" | "waiting" | "timeout"

export const INITIAL_LOCATION: LocationState = {
  phase: "checking",
  permission: "unknown",
  area: null,
}

export function locationView(state: LocationState) {
  const policy = LOCATION_STATES[state.phase]
  return {
    ...policy,
    canLocate: policy.canLocate && state.permission !== "denied",
    openOnSearch: policy.openOnSearch && !state.area,
    search: policy.search || Boolean(state.area),
    alert: policy.alert,
    pending: state.phase === "reading" || state.phase === "unanswered",
  }
}
