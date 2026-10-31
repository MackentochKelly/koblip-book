// The live voice socket's gate, run by the custom server for each upgrade
// to /api/voice/listen: same-origin, then the owner's check route, then a
// free voice slot, then `accept`. It never throws or rejects: a failure
// anywhere answers the upgrade with an HTTP error, so one bad request can
// never take the process down. Plain ESM like the relay, so the custom
// server can load it.

// How long the check route may take before the upgrade is refused.
export const CHECK_TIMEOUT_MS = 5_000

function rejectUpgrade(socket, status, text) {
  if (socket.destroyed) {
    return
  }
  socket.write(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\n\r\n`)
  socket.destroy()
}

// The check route's answer, only when it has every field the relay and
// the slots use.
function isSettings(value) {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof value.ownerId === "string" &&
    value.ownerId !== "" &&
    Number.isInteger(value.maxOpenSessions) &&
    value.maxOpenSessions > 0 &&
    typeof value.handshake === "object" &&
    value.handshake !== null &&
    typeof value.maxSessionSeconds === "number" &&
    typeof value.maxBufferedBytes === "number" &&
    typeof value.maxFrameBytes === "number"
  )
}

// `checkUrl`: the check route's address, the request's query appended.
// `accept(settings)`: completes the upgrade and starts the relay.
export async function handleVoiceUpgrade({
  request,
  socket,
  checkUrl,
  apiKey,
  slots,
  accept,
  fetchImpl = fetch,
  timeoutMs = CHECK_TIMEOUT_MS,
}) {
  // Until the upgrade completes, nothing else listens for errors on the
  // raw socket: a reset while waiting would be an uncaught 'error' event.
  const onError = () => socket.destroy()
  socket.on("error", onError)
  let release = null
  try {
    // Same origin only: the Origin host must equal the Host header.
    let originHost = null
    try {
      originHost =
        request.headers.origin == null
          ? null
          : new URL(request.headers.origin).host
    } catch {
      originHost = null
    }
    if (originHost === null || originHost !== request.headers.host) {
      rejectUpgrade(socket, 403, "Forbidden")
      return
    }

    // Owner checks stay inside Next: the internal check route sees the
    // request's cookie.
    const url = new URL(request.url || "/", "http://x")
    let check = null
    try {
      check = await fetchImpl(`${checkUrl}${url.search}`, {
        headers: request.headers.cookie
          ? { cookie: request.headers.cookie }
          : {},
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch {
      rejectUpgrade(socket, 503, "Service Unavailable")
      return
    }
    if (check.status !== 200) {
      rejectUpgrade(socket, check.status, "Rejected")
      return
    }
    if (!apiKey) {
      rejectUpgrade(socket, 503, "Service Unavailable")
      return
    }
    let settings = null
    try {
      settings = await check.json()
    } catch {
      settings = null
    }
    if (!isSettings(settings)) {
      rejectUpgrade(socket, 502, "Bad Gateway")
      return
    }
    // The browser may have gone while the check ran.
    if (socket.destroyed) {
      return
    }
    // At most a few open at once per owner. The slot frees when the
    // socket closes, however the session ends (or if the upgrade fails).
    release = slots.take(settings.ownerId, settings.maxOpenSessions)
    if (!release) {
      rejectUpgrade(socket, 429, "Too Many Requests")
      return
    }
    socket.once("close", release)
    // The websocket handles the socket's errors from here on.
    socket.removeListener("error", onError)
    accept(settings)
  } catch {
    release?.()
    socket.on("error", onError)
    rejectUpgrade(socket, 500, "Internal Server Error")
  }
}
