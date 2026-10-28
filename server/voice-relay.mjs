// Relay between one browser socket and Meta's realtime speech endpoint.
// Plain ESM: no imports from app code, so the custom server can load it.
// Sockets only need { send, close, on } (the `ws` shape). The upstream
// factory is injected so tests use fake sockets and never touch Meta.
//
// Protocol (Meta realtime docs): first client frame is the handshake JSON
// (schema fields plus authorization.accessToken "Bearer <key>"); the ack is
// the only frameless-`type` frame ({ sessionId }); audio is binary frames;
// {"type":"endStream"} half-closes our side; upstream closes with 1000.

const FORWARDED = new Set([
  "speechStart",
  "transcript",
  "speechEnd",
  "speechComplete",
])

const CLOSE_CODES = {
  1008: "bad_request",
  1011: "unavailable",
  1013: "rate_limited",
}

export function relayVoice({ client, openUpstream, settings, apiKey }) {
  let upstream = null
  let acked = false
  let stopped = false
  let closed = false
  let buffered = []
  let bufferedBytes = 0

  const sendError = (code) => {
    try {
      client.send(JSON.stringify({ type: "error", code }))
    } catch {
      // The client is already gone; closing below finishes it.
    }
  }

  const closeBoth = (code) => {
    if (closed) {
      return
    }
    closed = true
    clearTimeout(timer)
    try {
      if (upstream) {
        upstream.close()
      }
    } catch {
      // Already closing; the client close below is what matters.
    }
    try {
      client.close(code)
    } catch {
      // Already gone.
    }
  }

  const fail = (code) => {
    sendError(code)
    closeBoth()
  }

  const doStop = () => {
    if (stopped || closed) {
      return
    }
    stopped = true
    try {
      if (upstream) {
        upstream.send(JSON.stringify({ type: "endStream" }))
      }
    } catch {
      // Upstream gone; its close handler finishes the session.
    }
  }

  const timer = setTimeout(doStop, settings.maxSessionSeconds * 1000)

  upstream = openUpstream("wss://api.meta.ai/v1/asr/realtime")

  upstream.on("open", () => {
    try {
      upstream.send(
        JSON.stringify({
          ...settings.handshake,
          authorization: { accessToken: `Bearer ${apiKey}` },
        })
      )
    } catch {
      fail("unavailable")
    }
  })

  upstream.on("message", (data, isBinary) => {
    if (closed || isBinary) {
      return
    }
    let msg = null
    try {
      msg = JSON.parse(data.toString())
    } catch {
      return
    }
    if (msg && msg.type === "error") {
      // Fatal upstream: hide Meta's message and session id.
      fail("unavailable")
      return
    }
    if (!acked) {
      if (msg && typeof msg.sessionId === "string" && msg.type === undefined) {
        acked = true
        for (const chunk of buffered) {
          try {
            upstream.send(chunk)
          } catch {
            fail("unavailable")
            return
          }
        }
        buffered = []
        bufferedBytes = 0
      }
      return
    }
    if (msg && FORWARDED.has(msg.type)) {
      try {
        client.send(data.toString())
      } catch {
        closeBoth()
      }
    }
    // audioProgress, speaker frames and unknown types are ignored.
  })

  upstream.on("close", (code) => {
    if (closed) {
      return
    }
    if (code === 1000) {
      closeBoth(1000)
      return
    }
    fail(CLOSE_CODES[code] ?? "unavailable")
  })

  upstream.on("error", () => {
    if (!closed) {
      fail("unavailable")
    }
  })

  client.on("message", (data, isBinary) => {
    if (closed) {
      return
    }
    if (!isBinary) {
      let msg = null
      try {
        msg = JSON.parse(data.toString())
      } catch {
        return
      }
      if (msg && msg.type === "stop") {
        doStop()
      }
      return
    }
    if (data.length > settings.maxFrameBytes) {
      sendError("bad_request")
      return
    }
    if (stopped) {
      return
    }
    if (!acked) {
      buffered.push(data)
      bufferedBytes += data.length
      if (bufferedBytes > settings.maxBufferedBytes) {
        fail("bad_request")
      }
      return
    }
    try {
      upstream.send(data)
    } catch {
      fail("unavailable")
    }
  })

  client.on("close", () => {
    closeBoth()
  })

  client.on("error", () => {
    closeBoth()
  })
}
