"use client"

import { useEffect, useRef, useState } from "react"
import { motion } from "motion/react"
import {
  AlertCircleIcon,
  MapPinIcon,
  NavigationIcon,
} from "@/components/ui/icons"

import { SearchField } from "@/components/search-field"
import { glassClassName, glassEdgeClassName } from "@/components/glass-frame"
import { VoiceGlobe } from "@/components/voice-globe"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { FieldSeparator } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"
import { NUDGE } from "@/lib/motion-tokens"
import { ONBOARDING_RULES } from "@/lib/onboarding-rules"
import { cityCenter, searchCities } from "../api/search-actions"
import type { CitySuggestion } from "../types"
import type { LocationAlert, SearchArea } from "../utils/location-state"
import { useDebounced } from "../utils/use-debounced"
import { useSessionToken } from "../utils/use-session-token"
import { SuggestionList } from "./suggestion-list"
import { noAutofill } from "@/lib/no-autofill"
import type { OnboardingWords } from "../i18n"

// Where business search looks first: the phone's location (the one main
// action) or a city. A dialog in the middle of the screen on a phone too,
// so it reads as a question before the search.
export function SearchAreaPanel({
  open,
  onClose,
  onPick,
  locate,
  onCityPick,
  locating,
  pending,
  canLocate,
  locationAlert,
  finalFocus,
  words: t,
}: {
  open: boolean
  onClose: () => void
  onPick: (area: SearchArea) => void
  locate: () => void
  onCityPick: () => void
  locating: boolean
  pending: boolean
  // False once the browser won't give a location: cities only.
  canLocate: boolean
  locationAlert: LocationAlert
  // Where focus goes on close (Base UI Dialog.Popup `finalFocus`).
  finalFocus: boolean | React.RefObject<HTMLElement | null>
  words: OnboardingWords["area"]
}) {
  const [query, setQuery] = useState("")
  const [cities, setCities] = useState<CitySuggestion[]>([])
  const [picking, setPicking] = useState<string | null>(null)
  const pickRun = useRef(0)
  const { current: sessionToken, renew } = useSessionToken()
  const needle = useDebounced(query.trim(), ONBOARDING_RULES.debounceMs)

  useEffect(() => {
    let current = true
    queueMicrotask(() => {
      if (current) setPicking(null)
    })
    return () => {
      current = false
      pickRun.current += 1
    }
  }, [open])

  useEffect(() => {
    let current = true
    if (needle.length < ONBOARDING_RULES.minInput) {
      queueMicrotask(() => current && setCities([]))
      return () => {
        current = false
      }
    }
    void searchCities({ input: needle, sessionToken: sessionToken() })
      .catch(() => [])
      .then((found) => current && setCities(found))
    return () => {
      current = false
    }
  }, [needle, sessionToken])

  const pick = async (city: CitySuggestion) => {
    const run = ++pickRun.current
    onCityPick()
    setPicking(city.placeId)
    const center = await cityCenter({
      placeId: city.placeId,
      sessionToken: sessionToken(),
    }).catch(() => null)
    if (run !== pickRun.current) return
    renew()
    setPicking(null)
    if (!center) return
    setQuery("")
    onPick({ label: city.name, center })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent className="sm:max-w-sm" finalFocus={finalFocus}>
        <DialogHeader className="items-center gap-0 text-center">
          {/* The app's moving colour globe, with a glass pin on it. */}
          <div className="relative mt-2 mb-4 size-28">
            <VoiceGlobe className="size-full" />
            <span
              aria-hidden
              className={cn(
                "absolute inset-0 m-auto flex size-12 items-center justify-center rounded-full border text-primary-foreground shadow-card [&_svg]:size-6",
                glassClassName,
                glassEdgeClassName
              )}
            >
              <MapPinIcon />
            </span>
          </div>
          <DialogTitle className="text-xl leading-tight">{t.title}</DialogTitle>
          <DialogDescription>{t.helper}</DialogDescription>
        </DialogHeader>
        {canLocate && (
          <>
            <div className="mb-2 flex flex-col items-center">
              {/* Shakes a few times as the window opens, so the eye finds it. */}
              <motion.div animate={NUDGE}>
                <Button
                  size="lg"
                  onClick={() => {
                    pickRun.current += 1
                    setPicking(null)
                    locate()
                  }}
                  disabled={pending}
                >
                  {locating ? (
                    <Spinner data-icon="inline-start" />
                  ) : (
                    <NavigationIcon data-icon="inline-start" />
                  )}
                  {t.useLocation}
                </Button>
              </motion.div>
              {/* The app's error look (shadcn Alert, read out as it appears). */}
              {locationAlert !== "none" && !locating && (
                <Alert
                  variant={
                    locationAlert === "waiting" ? "default" : "destructive"
                  }
                  role={locationAlert === "waiting" ? "status" : "alert"}
                  className="mt-3"
                >
                  <AlertCircleIcon />
                  <AlertDescription>
                    {locationAlert === "settings"
                      ? t.turnOnLocation
                      : locationAlert === "waiting"
                        ? t.waiting
                        : locationAlert === "timeout"
                          ? t.timeout
                          : t.notFound}
                  </AlertDescription>
                </Alert>
              )}
            </div>
            <FieldSeparator className="*:data-[slot=field-separator-content]:bg-popover">
              {t.or}
            </FieldSeparator>
          </>
        )}
        <div className="flex flex-col gap-3">
          <SearchField
            {...noAutofill("city")}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t.city}
            aria-label={t.city}
          />
          {/* The cities scroll, so the dialog fits above a phone's keyboard. */}
          {cities.length > 0 && (
            <div className="-mx-1 max-h-[40dvh] scroll-fade overflow-y-auto overscroll-contain px-1">
              <SuggestionList
                items={cities.map((city) => ({
                  id: city.placeId,
                  title: city.name,
                  description: city.region,
                }))}
                busyId={picking}
                onPick={(id) => {
                  const city = cities.find((found) => found.placeId === id)
                  if (city) void pick(city)
                }}
                icon={<MapPinIcon />}
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
