"use client"

import { useEffect, useState } from "react"
import {
  AdvancedMarker,
  APIProvider,
  Map as GoogleMap,
  Pin,
} from "@vis.gl/react-google-maps"
import { useTheme } from "next-themes"

import { usePageLanguage } from "@/components/language-provider"

const BROWSER_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY
const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID

// Where the business is, on a live Google map. With no key or map ID, or a
// key Google refuses, it shows no map; the address and button below still work.
export function BusinessMap({
  name,
  latitude,
  longitude,
}: {
  name: string
  latitude: number
  longitude: number
}) {
  const { resolvedTheme } = useTheme()
  const language = usePageLanguage()
  const [rejected, setRejected] = useState(false)
  useEffect(() => {
    const host = window as typeof window & { gm_authFailure?: () => void }
    const previous = host.gm_authFailure
    host.gm_authFailure = () => {
      setRejected(true)
      previous?.()
    }
    return () => {
      host.gm_authFailure = previous
    }
  }, [])
  if (!BROWSER_KEY || !MAP_ID || rejected) return null
  const position = { lat: latitude, lng: longitude }
  return (
    <APIProvider apiKey={BROWSER_KEY} version="weekly" language={language}>
      <div className="h-56 overflow-hidden rounded-xl border md:h-72">
        <GoogleMap
          key={resolvedTheme}
          defaultCenter={position}
          defaultZoom={16}
          style={{ width: "100%", height: "100%" }}
          gestureHandling="cooperative"
          disableDefaultUI
          mapId={MAP_ID}
          colorScheme={resolvedTheme === "dark" ? "DARK" : "LIGHT"}
        >
          <AdvancedMarker position={position} title={name}>
            <Pin />
          </AdvancedMarker>
        </GoogleMap>
      </div>
    </APIProvider>
  )
}
