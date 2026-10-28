import "server-only"

import { ASSISTANT_RULES } from "@/lib/assistant-rules"

// Route handlers have no built-in CSRF protection like server actions do:
// refuse a request whose Origin header names another host. A missing
// Origin (curl, non-browser clients) is allowed. Compare against the Host
// header nginx forwarded, NOT request.url: in production the app binds
// localhost:3100, so request.url names the local address while the Host
// header names the public site the browser sees. Fall back to the URL
// when no Host header is present.
export function isCrossSiteRequest(request: Request): boolean {
  const origin = request.headers.get("origin")
  if (!origin) {
    return false
  }
  const host = request.headers.get("host") ?? urlHost(request.url)
  try {
    return new URL(origin).host !== host
  } catch {
    return true
  }
}

function urlHost(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return ""
  }
}

export interface RequestBudget {
  signal: AbortSignal
  done: () => void
}

// Total time for one chat request plus client disconnect, as one signal.
// Call done() when the stream closes so the timer does not linger.
export function requestBudget(request: Request): RequestBudget {
  const combined = new AbortController()
  let timer: ReturnType<typeof setTimeout> | null = setTimeout(
    () => combined.abort(),
    ASSISTANT_RULES.maxRequestMs
  )
  const done = (): void => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    request.signal.removeEventListener("abort", onAbort)
  }
  const onAbort = (): void => {
    done()
    combined.abort()
  }
  if (request.signal.aborted) {
    onAbort()
  } else {
    request.signal.addEventListener("abort", onAbort, { once: true })
  }
  return { signal: combined.signal, done }
}
