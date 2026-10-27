"use client"

import { useEffect, useState } from "react"
import { LocateFixedIcon, MapPinIcon, SearchIcon } from "lucide-react"

import { ResponsivePanel } from "@/components/responsive-panel"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { Spinner } from "@/components/ui/spinner"
import { cityCenter, searchCities } from "../api/search-actions"
import type { CitySuggestion, Coordinates } from "../types"
import { useDebounced } from "../utils/use-debounced"
import { useSessionToken } from "../utils/use-session-token"

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
}: {
  open: boolean
  onClose: () => void
  onPick: (area: SearchArea) => void
  locate: () => void
  locating: boolean
}) {
  const [query, setQuery] = useState("")
  const [cities, setCities] = useState<CitySuggestion[]>([])
  const [picking, setPicking] = useState<string | null>(null)
  const { current: sessionToken, renew } = useSessionToken()
  const needle = useDebounced(query.trim(), 250)

  useEffect(() => {
    let current = true
    if (needle.length < 2) {
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
    <ResponsivePanel open={open} onClose={onClose} title="Search near">
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
            <ItemTitle>Use my location</ItemTitle>
          </ItemContent>
        </Item>
        <InputGroup>
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="City"
            aria-label="City"
            autoComplete="off"
          />
        </InputGroup>
        {cities.length > 0 && (
          <ItemGroup className="gap-1">
            {cities.map((city) => (
              <Item
                key={city.placeId}
                size="sm"
                render={
                  <button type="button" onClick={() => void pick(city)} />
                }
                className="text-left hover:bg-muted"
              >
                <ItemMedia variant="icon">
                  {picking === city.placeId ? <Spinner /> : <MapPinIcon />}
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>{city.name}</ItemTitle>
                  {city.region && (
                    <ItemDescription>{city.region}</ItemDescription>
                  )}
                </ItemContent>
              </Item>
            ))}
          </ItemGroup>
        )}
      </div>
    </ResponsivePanel>
  )
}
