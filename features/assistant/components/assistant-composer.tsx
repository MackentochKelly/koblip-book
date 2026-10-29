"use client"

import { useState } from "react"
import {
  ArrowUpIcon,
  AudioLinesIcon,
  SquareIcon,
  XIcon,
} from "@/components/ui/icons"
import { toast } from "sonner"

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group"
import { Spinner } from "@/components/ui/spinner"
import { VoiceGlobe } from "@/components/voice-globe"
import { VoiceWaveform } from "@/components/voice-waveform"
import { useStoredFlag } from "@/hooks/use-stored-flag"
import { ASSISTANT_RULES } from "@/lib/assistant-rules"
import { VOICE_RULES } from "@/lib/voice-rules"
import type { AssistantMessages } from "../i18n"
import type { AnswerListener } from "../types"
import { useLiveVoice, type LiveVoiceError } from "../hooks/use-live-voice"
import type { Reply } from "../utils/live-voice-session"
import { VoiceIntro } from "./voice-intro"

// Set on this device once the owner picks "Don't show again".
const VOICE_INTRO_HIDDEN_KEY = "assistant-voice-intro-hidden"

type Mode = "stop" | "working" | "send" | "live"

// What the one button says to a screen reader in each state.
const MODE_LABELS: Record<
  Mode,
  (labels: AssistantMessages["composer"]) => string
> = {
  stop: (labels) => labels.stop,
  working: (labels) => labels.send,
  send: (labels) => labels.send,
  live: (labels) => labels.live.start,
}

// The message box. Enter sends; Shift+Enter starts a new line. Like
// ChatGPT: the voice button talks live (the box then shows what it hears,
// and an end button).
export function AssistantComposer({
  businessId,
  labels,
  errors,
  busy,
  stoppable,
  onSend,
  onSendSpoken,
  onStop,
  onCutOff,
  onWithdraw,
}: {
  businessId: string
  labels: AssistantMessages["composer"]
  errors: AssistantMessages["errors"]
  busy: boolean
  // While a question is being answered, the send button stops it.
  stoppable: boolean
  onSend: (text: string) => void
  // A turn said in talking mode; resolves with the reply to read out.
  onSendSpoken: (
    text: string,
    options: { voice: boolean; listen: AnswerListener }
  ) => Promise<Reply | null>
  onStop: () => void
  // Talking mode: the owner cut an answer off; `heard` is all they got.
  onCutOff: (heard: string) => void
  // Talking mode: takes the last question and its unfinished answer off.
  onWithdraw: () => void
}) {
  const [text, setText] = useState("")
  const canSend = text.trim() !== "" && !busy
  const live = useLiveVoice({
    businessId,
    voiceId: VOICE_RULES.speakVoiceId,
    busy,
    send: onSendSpoken,
    stopAnswer: onStop,
    onCutOff,
    onWithdraw,
    confirmLine: labels.live.confirmLine,
    fillers: labels.live.fillers,
    cutIns: labels.live.cutIns,
    greeting: labels.live.greeting,
    onError: (error: LiveVoiceError) =>
      toast.error(error === "mic_denied" ? labels.micDenied : errors[error]),
  })

  // The main button: stop an answer, send while there are words, talk
  // live while the box is empty.
  const mode: Mode = stoppable
    ? "stop"
    : busy
      ? "working"
      : text.trim() !== "" || !live.supported
        ? "send"
        : "live"

  // Talking live opens the voice intro first, until "Don't show again".
  const [introHidden, hideIntro] = useStoredFlag(VOICE_INTRO_HIDDEN_KEY)
  const [introOpen, setIntroOpen] = useState(false)
  const startLive = () => {
    if (introHidden) {
      void live.start()
    } else {
      setIntroOpen(true)
    }
  }

  const submit = () => {
    if (!canSend) return
    onSend(text)
    setText("")
  }

  if (live.state !== "off") {
    return (
      <div className="flex flex-col items-center gap-6">
        <VoiceGlobe
          getInputVolume={live.getInputVolume}
          getOutputVolume={live.getOutputVolume}
          className="size-32"
        />
        <InputGroup>
          {/* What it hears, as it hears it; the state while it's quiet. */}
          <InputGroupTextarea
            readOnly
            value={live.caption}
            rows={1}
            placeholder={labels.live[live.state]}
            aria-label={labels.label}
            aria-live="polite"
            className="max-h-32 min-h-11"
          />
          {/* Like Claude's voice mode: the voice as bars in the middle (the
              owner's, then the answer's), a soft wave while connecting or
              thinking; End on the right. */}
          <InputGroupAddon
            align="block-end"
            className="grid grid-cols-[1fr_auto_1fr]"
          >
            <VoiceWaveform
              getFrequencies={live.getVoiceFrequencies}
              processing={
                live.state === "connecting" || live.state === "thinking"
              }
              label={labels.live.waveform}
              className="col-start-2 h-10 w-56 text-muted-foreground sm:w-72"
            />
            <InputGroupButton
              className="justify-self-end"
              variant="default"
              size="icon-sm"
              aria-label={labels.live.end}
              onClick={live.end}
            >
              <XIcon />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </div>
    )
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
        {/* Like big chat apps: the words on top, the buttons under them;
            the round one changes with what the owner is doing. */}
        <InputGroupAddon align="block-end" className="justify-end">
          {/* A new key per state, so each change fades and grows in, in
              the same spot (instant with reduced motion). */}
          <InputGroupButton
            key={mode}
            type={mode === "send" ? "submit" : "button"}
            variant="default"
            size="icon-sm"
            aria-label={MODE_LABELS[mode](labels)}
            disabled={mode === "working" || (mode === "send" && !canSend)}
            onClick={
              mode === "stop" ? onStop : mode === "live" ? startLive : undefined
            }
            className="animate-in duration-150 zoom-in-75 fade-in motion-reduce:animate-none"
          >
            {mode === "working" ? (
              <Spinner />
            ) : mode === "stop" ? (
              <SquareIcon />
            ) : mode === "live" ? (
              <AudioLinesIcon />
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
          void live.start()
        }}
        onNeverShow={() => {
          hideIntro()
          setIntroOpen(false)
          void live.start()
        }}
      />
    </form>
  )
}
