import type { Coordinates } from "../types"

export type SearchArea = { center: Coordinates } & (
  | { isCurrentLocation: true; label?: never }
  | { isCurrentLocation?: false; label: string }
)

// One policy for the pill, panel button, search tap, and existing Alert.
// The pill itself always opens the panel and is never disabled. A search tap
// opens it only where search has nothing to go on yet, and only until this
// device has seen it once (see locationView). A failure never opens it: an
// Alert only shows to someone who opened the panel.
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
  // The browser reports location as allowed: the next search tap reads it, and
  // a quiet read that fails comes back here.
  ready: {
    busy: false,
    canLocate: true,
    openOnSearch: false,
    alert: "none",
    search: true,
  },
  // The browser already refuses this site, from before this page load.
  "denied-site": {
    busy: false,
    canLocate: false,
    openOnSearch: true,
    alert: "none",
    search: false,
  },
  // A tap on the button got a no without a browser grant. It may be the
  // visitor's own answer, so this is a calm note and not an error.
  refused: {
    busy: false,
    canLocate: false,
    openOnSearch: false,
    alert: "off",
    search: true,
  },
  // A tap on the button got a no although the browser allows this site.
  "denied-other": {
    busy: false,
    canLocate: true,
    openOnSearch: false,
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
    openOnSearch: false,
    alert: "waiting",
    search: true,
  },
  failed: {
    busy: false,
    canLocate: true,
    openOnSearch: false,
    alert: "not-found",
    search: true,
  },
  "timed-out": {
    busy: false,
    canLocate: true,
    openOnSearch: false,
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
  "none" | "not-found" | "settings" | "off" | "waiting" | "timeout"

export const INITIAL_LOCATION: LocationState = {
  phase: "checking",
  permission: "unknown",
  area: null,
}

// asked: this device has already seen the panel, so search goes ahead
// ("Anywhere") and the pill stays there for whoever wants a place.
export function locationView(state: LocationState, asked = false) {
  const policy = LOCATION_STATES[state.phase]
  return {
    ...policy,
    canLocate: policy.canLocate && state.permission !== "denied",
    openOnSearch: policy.openOnSearch && !state.area && !asked,
    search: policy.search || Boolean(state.area) || asked,
    alert: policy.alert,
    pending: state.phase === "reading" || state.phase === "unanswered",
  }
}
