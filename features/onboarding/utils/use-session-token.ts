import { useCallback, useRef } from "react"

// One Google session token per search: every suggestion request of that
// search shares it, the place lookup ends it, then the next search gets a
// new one (Places API session pricing).
export function useSessionToken() {
  const token = useRef<string | null>(null)
  const current = useCallback(() => {
    token.current ??= crypto.randomUUID()
    return token.current
  }, [])
  const renew = useCallback(() => {
    token.current = null
  }, [])
  return { current, renew }
}
