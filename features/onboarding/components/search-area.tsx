"use client"

import { useEffect, useState } from "react"
import { LocateFixedIcon, MapPinIcon, SearchIcon } from "@/components/ui/icons"

import { ResponsivePanel } from "@/components/responsive-panel"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Item, ItemContent, ItemMedia, ItemTitle } from "@/components/ui/item"
import { Spinner } from "@/components/ui/spinner"
import { ONBOARDING_RULES } from "@/lib/onboarding-rules"
import { cityCenter, searchCities } from "../api/search-actions"
import type { CitySuggestion, Coordinates } from "../types"
import { useDebounced } from "../utils/use-debounced"
import { useSessionToken } from "../utils/use-session-token"
import { SuggestionList } from "./suggestion-list"
import { noAutofill } from "@/lib/no-autofill"
import type { OnboardingWords } from "../i18n"

export interface SearchArea {
  label: string
  center: Coordinates
}

// Where business search looks first: the phone's location or a city.
export function SearchAreaPanel({
  open,
  onClose,
  onPick,
  locate,
  locating,
  words: t,
}: {
  open: boolean
  onClose: () => void
  onPick: (area: SearchArea) => void
  locate: () => void
  locating: boolean
  words: OnboardingWords["area"]
}) {
  const [query, setQuery] = useState("")
  const [cities, setCities] = useState<CitySuggestion[]>([])
  const [picking, setPicking] = useState<string | null>(null)
  const { current: sessionToken, renew } = useSessionToken()
  const needle = useDebounced(query.trim(), ONBOARDING_RULES.debounceMs)

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
    setPicking(city.placeId)
    const center = await cityCenter({
      placeId: city.placeId,
      sessionToken: sessionToken(),
    }).catch(() => null)
    renew()
    setPicking(null)
    if (!center) return
    setQuery("")
    onPick({ label: city.name, center })
  }

  return (
    <ResponsivePanel open={open} onClose={onClose} title={t.title}>
      <div className="flex flex-col gap-3">
        <Item
          variant="outline"
          render={<button type="button" onClick={locate} />}
          className="text-left"
        >
          <ItemMedia variant="icon">
            {locating ? <Spinner /> : <LocateFixedIcon />}
          </ItemMedia>
          <ItemContent>
            <ItemTitle>{t.useLocation}</ItemTitle>
          </ItemContent>
        </Item>
        <InputGroup>
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            {...noAutofill("city")}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t.city}
            aria-label={t.city}
          />
        </InputGroup>
        {cities.length > 0 && (
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
        )}
      </div>
    </ResponsivePanel>
  )
}
