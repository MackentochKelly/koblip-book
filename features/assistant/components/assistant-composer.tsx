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
import { useStoredFlag } from "@/hooks/use-stored-flag"
import { ASSISTANT_RULES } from "@/lib/assistant-rules"
import type { AssistantMessages } from "../i18n"
import { useVoiceInput, type VoiceError } from "../hooks/use-voice-input"
import { VoiceIntro } from "./voice-intro"

// Set on this device once the owner picks "Don't show again".
const VOICE_INTRO_HIDDEN_KEY = "assistant-voice-intro-hidden"

type Mode = "stop" | "recording" | "transcribing" | "working" | "send" | "mic"

// What the one button says to a screen reader in each state.
const MODE_LABELS: Record<
  Mode,
  (labels: AssistantMessages["composer"]) => string
> = {
  stop: (labels) => labels.stop,
  recording: (labels) => labels.stop,
  transcribing: (labels) => labels.mic,
  working: (labels) => labels.send,
  send: (labels) => labels.send,
  mic: (labels) => labels.mic,
}

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

  // The one button: stop an answer, the voice states, send while there are
  // words, the microphone while the box is empty.
  const mode: Mode = stoppable
    ? "stop"
    : voice.state === "recording"
      ? "recording"
      : voice.state === "transcribing"
        ? "transcribing"
        : busy
          ? "working"
          : text.trim() !== "" || !voice.supported
            ? "send"
            : "mic"

  // The mic opens the voice intro first, until "Don't show again".
  const [introHidden, hideIntro] = useStoredFlag(VOICE_INTRO_HIDDEN_KEY)
  const [introOpen, setIntroOpen] = useState(false)
  const startVoice = () => {
    if (introHidden) {
      voice.start()
    } else {
      setIntroOpen(true)
    }
  }

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
        {/* Like big chat apps: the words on top, one round button under
            them that changes with what the owner is doing. */}
        <InputGroupAddon align="block-end" className="justify-end">
          {/* A new key per state, so each change fades and grows in, in
              the same spot (instant with reduced motion). */}
          <InputGroupButton
            key={mode}
            type={mode === "send" ? "submit" : "button"}
            variant={mode === "recording" ? "destructive" : "default"}
            size="icon-sm"
            aria-label={MODE_LABELS[mode](labels)}
            disabled={
              mode === "transcribing" ||
              mode === "working" ||
              (mode === "send" && !canSend)
            }
            onClick={
              mode === "stop"
                ? onStop
                : mode === "mic"
                  ? startVoice
                  : mode === "recording"
                    ? voice.stop
                    : undefined
            }
            className="animate-in duration-150 zoom-in-75 fade-in motion-reduce:animate-none"
          >
            {mode === "transcribing" || mode === "working" ? (
              <Spinner />
            ) : mode === "stop" || mode === "recording" ? (
              <SquareIcon />
            ) : mode === "mic" ? (
              <MicIcon />
            ) : (
              <ArrowUpIcon />
            )}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      <VoiceIntro
        open={introOpen}
        labels={labels.voiceIntro}
        onClose={() => setIntroOpen(false)}
        onContinue={() => {
          setIntroOpen(false)
          voice.start()
        }}
        onNeverShow={() => {
          hideIntro()
          setIntroOpen(false)
          voice.start()
        }}
      />
    </form>
  )
}
