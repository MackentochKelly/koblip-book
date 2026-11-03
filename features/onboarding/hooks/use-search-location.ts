"use client"

import { useCallback, useEffect, useRef, useState } from "react"
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

export function useSearchLocation() {
  const [state, setState] = useState<LocationState>(INITIAL_LOCATION)
  const snapshot = useRef(state)
  const [open, setOpen] = useState(false)
  const revision = useRef(0)
  const request = useRef(0)
  const active = useRef<number | null>(null)
  const stopWatch = useRef<(() => void) | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const dismissed = useRef(false)
  const wantsPanel = useRef(false)
  const cityChosen = useRef(false)

  const publish = useCallback((next: LocationState) => {
    snapshot.current = next
    setState(next)
  }, [])

  const locate = useCallback(
    (explicit = true) => {
      if (active.current !== null) return
      if (!navigator.geolocation) {
        publish({ ...snapshot.current, phase: "unsupported" })
        setOpen(true)
        return
      }
      cityChosen.current = false
      if (explicit) dismissed.current = false
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
      const stop = () => {
        settled = true
        if (watchId !== undefined) navigator.geolocation.clearWatch(watchId)
        if (stopWatch.current === stop) stopWatch.current = null
      }
      stopWatch.current = stop
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
        async (error) => {
          if (
            settled ||
            selection !== revision.current ||
            id !== active.current
          )
            return
          stop()
          clearTimeout(timer.current)
          const status =
            error.code === error.PERMISSION_DENIED
              ? await locationPermission()
              : null
          if (selection !== revision.current || id !== active.current) return
          clearTimeout(timer.current)
          active.current = null
          const denied = error.code === error.PERMISSION_DENIED
          // W3C: PERMISSION_DENIED may be OS-level even with a browser grant.
          // Without a grant, the API does not reliably identify the denial layer.
          publish({
            ...snapshot.current,
            permission: status?.state ?? snapshot.current.permission,
            phase: denied
              ? status?.state === "granted"
                ? "denied-other"
                : "denied-site"
              : error.code === 3
                ? "timed-out"
                : "failed",
          })
          if (!dismissed.current) setOpen(true)
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
            previous.phase === "checking" || previous.phase === "denied-site"
              ? "prompt"
              : previous.phase,
        })
        if (
          permission === "granted" &&
          !previous.area &&
          !cityChosen.current &&
          active.current === null
        )
          locate(false)
      }
      if (wantsPanel.current && permission !== "granted" && !dismissed.current)
        setOpen(true)
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
  }, [locate, publish])

  const cancelForCity = () => {
    stopWatch.current?.()
    cityChosen.current = true
    revision.current += 1
    active.current = null
    clearTimeout(timer.current)
    const area = snapshot.current.area
    publish({
      ...snapshot.current,
      phase: area?.isCurrentLocation ? "found" : area ? "city" : "prompt",
    })
  }

  const view = locationView(state)
  return {
    state,
    view,
    open,
    locate,
    openPanel: () => {
      dismissed.current = false
      setOpen(true)
    },
    closePanel: () => {
      dismissed.current = true
      setOpen(false)
    },
    askLocation: () => {
      wantsPanel.current = true
      if (locationView(snapshot.current).openOnSearch) {
        dismissed.current = false
        setOpen(true)
      }
    },
    cancelForCity,
    pickCity: (area: SearchArea) => {
      cancelForCity()
      publish({ ...snapshot.current, phase: "city", area })
      setOpen(false)
    },
  }
}
