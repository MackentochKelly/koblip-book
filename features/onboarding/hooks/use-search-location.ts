"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useStoredFlag } from "@/hooks/use-stored-flag"
import { ONBOARDING_RULES } from "@/lib/onboarding-rules"
import {
  INITIAL_LOCATION,
  locationView,
  type LocationState,
  type SearchArea,
} from "../utils/location-state"

async function locationPermission(): Promise<PermissionStatus | null> {
  try {
    return (await navigator.permissions?.query({ name: "geolocation" })) ?? null
  } catch {
    // Unsupported permission names reject in some browsers. The explicit
    // location button remains the fallback; a query never requests consent.
    return null
  }
}

// Location is only ever read after a tap, and the panel only ever opens from
// one, so loading or reloading the page does nothing the visitor can see.
// https://web.dev/articles/permissions-best-practices
// A read on load can raise the phone's own prompt, and Safari keeps a "no" for
// the rest of the page load: "the permission state can not change again".
// https://github.com/WebKit/WebKit/blob/main/Source/WebCore/Modules/geolocation/Geolocation.cpp
export function useSearchLocation() {
  const [state, setState] = useState<LocationState>(INITIAL_LOCATION)
  const snapshot = useRef(state)
  const [open, setOpen] = useState(false)
  // Once this device has seen the panel it never opens by itself again. The
  // local half still counts for this page load when the browser blocks storage.
  const [askedBefore, rememberAsked] = useStoredFlag(
    ONBOARDING_RULES.locationAskedKey
  )
  const [askedHere, setAskedHere] = useState(false)
  const asked = askedBefore || askedHere
  const askedNow = useRef(asked)
  const panelOpen = useRef(false)
  const revision = useRef(0)
  const request = useRef(0)
  const active = useRef<number | null>(null)
  const stopWatch = useRef<(() => void) | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const tapWaiting = useRef(false)
  const quietReadDone = useRef(false)
  const cityChosen = useRef(false)

  useEffect(() => {
    askedNow.current = asked
    panelOpen.current = open
  }, [asked, open])

  const publish = useCallback((next: LocationState) => {
    snapshot.current = next
    setState(next)
  }, [])

  // explicit: the panel's button, so the visitor hears how it went. Otherwise
  // a quiet read from a search tap: a failure changes nothing they can see,
  // unless they opened the panel and are watching it.
  const locate = useCallback(
    (explicit = true) => {
      if (active.current !== null) return
      if (!navigator.geolocation) {
        publish({ ...snapshot.current, phase: "unsupported" })
        return
      }
      cityChosen.current = false
      const selection = revision.current
      const id = ++request.current
      active.current = id
      clearTimeout(timer.current)
      publish({ ...snapshot.current, phase: "reading" })
      // Stop animation without claiming acquisition failed.
      // A city remains available while the single browser request continues.
      timer.current = setTimeout(() => {
        if (selection !== revision.current || id !== active.current) return
        publish({
          ...snapshot.current,
          phase: "unanswered",
        })
      }, ONBOARDING_RULES.locationWaitMs)
      // One result through a watch allows cancellation on city selection/unmount.
      // https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/clearWatch
      let watchId: number | undefined = undefined
      let settled = false
      let retry: ReturnType<typeof setTimeout> | undefined = undefined
      const stop = () => {
        settled = true
        clearTimeout(retry)
        if (watchId !== undefined) navigator.geolocation.clearWatch(watchId)
        if (stopWatch.current === stop) stopWatch.current = null
      }
      stopWatch.current = stop
      const fail = async (error: GeolocationPositionError) => {
        stop()
        clearTimeout(timer.current)
        if (!explicit && !panelOpen.current) {
          active.current = null
          publish({ ...snapshot.current, phase: "ready" })
          return
        }
        const denied = error.code === error.PERMISSION_DENIED
        const status = denied ? await locationPermission() : null
        if (selection !== revision.current || id !== active.current) return
        clearTimeout(timer.current)
        active.current = null
        // W3C: PERMISSION_DENIED may be OS-level even with a browser grant.
        // Without a grant, the API does not reliably identify the denial layer.
        publish({
          ...snapshot.current,
          permission: status?.state ?? snapshot.current.permission,
          phase: denied
            ? status?.state === "granted"
              ? "denied-other"
              : "refused"
            : error.code === error.TIMEOUT
              ? "timed-out"
              : "failed",
        })
      }
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          if (settled || selection !== revision.current || cityChosen.current)
            return
          stop()
          // Ignore callbacks already queued before cancellation.
          revision.current += 1
          active.current = null
          clearTimeout(timer.current)
          publish({
            ...snapshot.current,
            phase: "found",
            area: {
              isCurrentLocation: true,
              center: {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
              },
            },
          })
          setOpen(false)
        },
        (error) => {
          if (
            settled ||
            selection !== revision.current ||
            id !== active.current
          )
            return
          // Often only "no fix yet": the watch stays alive and can still answer.
          // https://www.w3.org/TR/geolocation/#dfn-request-a-position
          // https://developer.apple.com/documentation/corelocation/cllocationmanagerdelegate/locationmanager(_:didfailwitherror:)
          if (error.code === error.POSITION_UNAVAILABLE) {
            retry ??= setTimeout(
              () => void fail(error),
              ONBOARDING_RULES.locationRetryMs
            )
            return
          }
          void fail(error)
        },
        {
          maximumAge: ONBOARDING_RULES.locationMaxAgeMs,
          timeout: ONBOARDING_RULES.locationTimeoutMs,
        }
      )
      // Browser callbacks are queued; also tolerate synchronous test doubles.
      if (settled) navigator.geolocation.clearWatch(watchId)
    },
    [publish]
  )

  const showPanel = useCallback(() => {
    askedNow.current = true
    setAskedHere(true)
    rememberAsked()
    setOpen(true)
  }, [rememberAsked])

  // A tap in the search box: read an allowed location once per page load, or
  // ask the first time ever. Every later tap just searches.
  const answerSearchTap = useCallback(() => {
    const now = snapshot.current
    if (now.phase === "checking") {
      tapWaiting.current = true
      return
    }
    if (
      now.phase === "ready" &&
      !quietReadDone.current &&
      !cityChosen.current
    ) {
      quietReadDone.current = true
      locate(false)
      return
    }
    if (locationView(now, askedNow.current).openOnSearch) showPanel()
  }, [locate, showPanel])

  useEffect(() => {
    let current = true
    let status: PermissionStatus | null = null
    const changed = () => {
      if (!current) return
      const permission = status?.state ?? "unknown"
      const previous = snapshot.current
      if (permission === "denied") {
        stopWatch.current?.()
        revision.current += 1
        active.current = null
        clearTimeout(timer.current)
        const area = previous.area?.isCurrentLocation ? null : previous.area
        publish({
          ...previous,
          permission,
          area,
          phase: area ? "city" : "denied-site",
        })
      } else {
        publish({
          ...previous,
          permission,
          phase:
            previous.phase === "checking" ||
            previous.phase === "prompt" ||
            previous.phase === "ready" ||
            previous.phase === "denied-site" ||
            previous.phase === "refused"
              ? permission === "granted"
                ? "ready"
                : "prompt"
              : previous.phase,
        })
      }
      if (tapWaiting.current) {
        tapWaiting.current = false
        answerSearchTap()
      }
    }
    void locationPermission().then((next) => {
      if (!current) return
      status = next
      status?.addEventListener("change", changed)
      changed()
    })
    return () => {
      current = false
      stopWatch.current?.()
      status?.removeEventListener("change", changed)
      revision.current += 1
      active.current = null
      clearTimeout(timer.current)
    }
  }, [answerSearchTap, publish])

  const cancelForCity = () => {
    stopWatch.current?.()
    cityChosen.current = true
    revision.current += 1
    active.current = null
    clearTimeout(timer.current)
    const { area, permission } = snapshot.current
    publish({
      ...snapshot.current,
      phase: area?.isCurrentLocation
        ? "found"
        : area
          ? "city"
          : permission === "granted"
            ? "ready"
            : "prompt",
    })
  }

  const view = locationView(state, asked)
  return {
    state,
    view,
    open,
    locate,
    openPanel: showPanel,
    closePanel: () => setOpen(false),
    askLocation: answerSearchTap,
    cancelForCity,
    pickCity: (area: SearchArea) => {
      cancelForCity()
      publish({ ...snapshot.current, phase: "city", area })
      setOpen(false)
    },
  }
}
