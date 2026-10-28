import "server-only"

import { ASSISTANT_RULES } from "@/lib/assistant-rules"

// Route handlers have no built-in CSRF protection like server actions do:
// refuse a request whose Origin header names another host. A missing
// Origin (curl, non-browser clients) is allowed.
export function isCrossSiteRequest(request: Request): boolean {
  const origin = request.headers.get("origin")
  if (!origin) {
    return false
  }
  try {
    return new URL(origin).host !== new URL(request.url).host
  } catch {
    return true
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
