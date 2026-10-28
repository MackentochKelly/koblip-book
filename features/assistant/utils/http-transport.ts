import type { AssistantTransport } from "../hooks/use-assistant-chat"
import type { AssistantStreamEvent } from "../types"

// One JSON event per line, as the server writes them.
async function* events(
  path: string,
  body: unknown
): AsyncGenerator<AssistantStreamEvent> {
  let response: Response
  try {
    response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  } catch {
    yield { type: "error", code: "unavailable" }
    return
  }
  if (response.status === 401) {
    yield { type: "error", code: "not_allowed" }
    return
  }
  if (!response.ok || !response.body) {
    yield { type: "error", code: "unavailable" }
    return
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let pending = ""
  const parse = (line: string): AssistantStreamEvent | null => {
    try {
      const event: unknown = JSON.parse(line)
      return typeof event === "object" && event !== null && "type" in event
        ? (event as AssistantStreamEvent)
        : null
    } catch {
      return null
    }
  }
  try {
    while (true) {
      const { value, done } = await reader.read()
      pending += decoder.decode(value, { stream: !done })
      const lines = pending.split("\n")
      pending = lines.pop() ?? ""
      for (const line of lines) {
        const event = line.trim() ? parse(line) : null
        if (event) yield event
      }
      if (done) break
    }
    const last = pending.trim() ? parse(pending) : null
    if (last) yield last
  } catch {
    yield { type: "error", code: "unavailable" }
  }
}

// The real server: POST /api/assistant and POST /api/assistant/confirm.
export const httpTransport: AssistantTransport = {
  chat: (request) => events("/api/assistant", request),
  confirm: (request) => events("/api/assistant/confirm", request),
}
