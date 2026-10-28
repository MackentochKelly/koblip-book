import type { AssistantStreamEvent } from "../types"
import type { AssistantTransport } from "../hooks/use-assistant-chat"

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function* words(text: string): AsyncGenerator<AssistantStreamEvent> {
  for (const word of text.split(" ")) {
    yield { type: "text", delta: word + " " }
    await wait(40)
  }
}

// A pretend server for building the screen before the real one exists.
// Say "error" to see a failure, "cancel" or "delete" to see a confirm card.
export const fakeTransport: AssistantTransport = {
  async *chat({ messages }) {
    const said = messages.at(-1)?.text.toLowerCase() ?? ""
    await wait(300)
    if (said.includes("error")) {
      yield { type: "error", code: "unavailable" }
      return
    }
    yield {
      type: "step",
      id: "s1",
      label: "Finding bookings…",
      status: "running",
    }
    await wait(900)
    yield { type: "step", id: "s1", label: "Found bookings", status: "done" }
    if (/cancel|delete|remove/.test(said)) {
      yield {
        type: "confirm",
        id: crypto.randomUUID(),
        title: "Cancel booking",
        summary: "Ana, haircut, tomorrow 3:00 PM",
        destructive: true,
      }
      yield* words("I need your OK before I do that.")
    } else {
      yield* words(
        "This is a preview answer. The real assistant is not connected yet."
      )
    }
    yield { type: "done" }
  },
  async *confirm({ accept }) {
    await wait(500)
    yield* words(accept ? "Done." : "Okay, I left it as it is.")
    yield { type: "done" }
  },
}
