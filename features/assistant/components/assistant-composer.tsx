"use client"

import { useState } from "react"
import { ArrowUpIcon, MicIcon, SquareIcon } from "@/components/ui/icons"
import { toast } from "sonner"

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group"
import { Spinner } from "@/components/ui/spinner"
import { ASSISTANT_RULES } from "@/lib/assistant-rules"
import type { AssistantMessages } from "../i18n"
import { useVoiceInput, type VoiceError } from "../hooks/use-voice-input"

// The message box. Enter sends; Shift+Enter starts a new line.
export function AssistantComposer({
  businessId,
  labels,
  errors,
  busy,
  stoppable,
  onSend,
  onStop,
}: {
  businessId: string
  labels: AssistantMessages["composer"]
  errors: AssistantMessages["errors"]
  busy: boolean
  // While a question is being answered, the send button stops it.
  stoppable: boolean
  onSend: (text: string) => void
  onStop: () => void
}) {
  const [text, setText] = useState("")
  const canSend = text.trim() !== "" && !busy
  const voice = useVoiceInput(
    businessId,
    (heard) => setText((current) => (current ? `${current} ${heard}` : heard)),
    (error: VoiceError) =>
      toast.error(error === "mic_denied" ? labels.micDenied : errors[error])
  )

  const submit = () => {
    if (!canSend) return
    onSend(text)
    setText("")
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <InputGroup>
        <InputGroupTextarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault()
              submit()
            }
          }}
          rows={1}
          maxLength={ASSISTANT_RULES.maxMessageChars}
          placeholder={labels.placeholder}
          aria-label={labels.label}
          enterKeyHint="send"
          className="max-h-32 min-h-11"
        />
        {/* Like big chat apps: the words on top, the buttons in a row
            under them. */}
        <InputGroupAddon align="block-end" className="justify-end">
          {voice.supported && (
            <InputGroupButton
              type="button"
              variant={voice.state === "recording" ? "destructive" : "ghost"}
              size="icon-sm"
              aria-label={
                voice.state === "recording" ? labels.stop : labels.mic
              }
              disabled={busy || voice.state === "transcribing"}
              onClick={voice.state === "recording" ? voice.stop : voice.start}
            >
              {voice.state === "transcribing" ? (
                <Spinner />
              ) : voice.state === "recording" ? (
                <SquareIcon />
              ) : (
                <MicIcon />
              )}
            </InputGroupButton>
          )}
          {stoppable ? (
            <InputGroupButton
              type="button"
              variant="default"
              size="icon-sm"
              aria-label={labels.stop}
              onClick={onStop}
            >
              <SquareIcon />
            </InputGroupButton>
          ) : (
            <InputGroupButton
              type="submit"
              variant="default"
              size="icon-sm"
              aria-label={labels.send}
              disabled={!canSend}
            >
              {busy ? <Spinner /> : <ArrowUpIcon />}
            </InputGroupButton>
          )}
        </InputGroupAddon>
      </InputGroup>
    </form>
  )
}
