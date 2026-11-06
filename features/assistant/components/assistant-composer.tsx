"use client"

import { useTranslations } from "next-intl"
import { useEffect, useEffectEvent, useRef, useState } from "react"
import {
  ArrowUpIcon,
  AudioLinesIcon,
  SquareIcon,
  XIcon,
} from "@/components/ui/icons"

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
import { ASSISTANT_NAME, ASSISTANT_RULES } from "@/lib/assistant-rules"
import type { PageLanguage } from "@/lib/page-language"
import { type LiveVoice, useLiveVoiceSupported } from "../hooks/use-live-voice"
import type { VoicePicking } from "../hooks/use-voice-choice"
import { VoiceIntro } from "./voice-intro"

// Set on this device once the owner picks "Don't show again".
const VOICE_INTRO_HIDDEN_KEY = "assistant-voice-intro-hidden"

type Mode = "stop" | "working" | "send" | "live"

// What the one button says to a screen reader in each state.
const MODE_LABELS = {
  stop: "stop",
  working: "send",
  send: "send",
  live: "live.start",
} as const satisfies Record<Mode, string>

// The message box. Enter sends; Shift+Enter starts a new line. Like
// ChatGPT: the voice button talks live (the box then shows what it hears,
// and an end button). The chat owns the live session (`live`), so the
// screen's buttons can speak into it too. On another page (Home's Ask
// card) `onTalkLive` takes the voice button to the assistant page, which
// gets `startLive` to offer it.
export function AssistantComposer({
  busy,
  stoppable,
  onSend,
  onStop,
  live,
  voice,
  onTalkLive,
  startLive: startLiveNow = false,
  inline = false,
}: {
  busy: boolean
  // While a question is being answered, the send button stops it.
  stoppable: boolean
  onSend: (text: string) => void
  onStop: () => void
  // The chat's live session; absent where talking live happens elsewhere.
  live?: LiveVoice
  // The owner's voice for it, asked for before the first talk.
  voice?: {
    picking: VoicePicking
    language: PageLanguage
  }
  // Talking live happens somewhere else: the voice button calls this.
  onTalkLive?: () => void
  // Offer talking live as soon as this shows (asked for on another page).
  startLive?: boolean
  // One line, the button beside the words (a card on another page); the
  // chat itself puts the buttons under them.
  inline?: boolean
}) {
  const t = useTranslations("assistant.composer")
  const [text, setText] = useState("")
  const canSend = text.trim() !== "" && !busy
  const supported = useLiveVoiceSupported()

  // The main button: stop an answer, send while there are words, talk
  // live while the box is empty.
  const mode: Mode = stoppable
    ? "stop"
    : busy
      ? "working"
      : text.trim() !== "" || !supported
        ? "send"
        : "live"

  // Talking live opens the voice intro first, until "Don't show again";
  // the intro always goes on to the voice step. Without the intro, the
  // voice step opens only while no chosen voice speaks the app's language.
  const [introHidden, hideIntro] = useStoredFlag(VOICE_INTRO_HIDDEN_KEY)
  const [introOpen, setIntroOpen] = useState(false)
  const talk = () => {
    if (voice && !voice.picking.speaks(voice.language)) voice.picking.ask()
    else void live?.start()
  }
  const startLive = () => {
    if (onTalkLive) {
      onTalkLive()
    } else if (introHidden) {
      talk()
    } else {
      setIntroOpen(true)
    }
  }
  // Asked for on another page: once, when it shows, the intro opens (even
  // after "Don't show again"), since phones only let the voice play when it
  // starts inside a tap here; its Continue is that tap.
  const started = useRef(false)
  const startLiveOnce = useEffectEvent(() => {
    if (started.current) return
    started.current = true
    setIntroOpen(true)
  })
  useEffect(() => {
    if (startLiveNow) startLiveOnce()
  }, [startLiveNow])

  const submit = () => {
    if (!canSend) return
    onSend(text)
    setText("")
  }

  if (live && live.state !== "off") {
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
            placeholder={t(`live.${live.state}`)}
            aria-label={t("label")}
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
              label={t("live.waveform")}
              className="col-start-2 h-10 w-56 text-muted-foreground sm:w-72"
            />
            <InputGroupButton
              className="justify-self-end"
              variant="default"
              size="icon-sm"
              aria-label={t("live.end")}
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
          placeholder={t("placeholder", { name: ASSISTANT_NAME })}
          aria-label={t("label")}
          enterKeyHint="send"
          className="max-h-32 min-h-11"
        />
        {/* Like big chat apps: the words on top, the buttons under them;
            the round one changes with what the owner is doing. */}
        <InputGroupAddon
          align={inline ? "inline-end" : "block-end"}
          className={inline ? undefined : "justify-end"}
        >
          {/* A new key per state, so each change fades and grows in, in
              the same spot (instant with reduced motion). */}
          <InputGroupButton
            key={mode}
            type={mode === "send" ? "submit" : "button"}
            variant="default"
            size="icon-sm"
            aria-label={t(MODE_LABELS[mode])}
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
      {voice && (
        <VoiceIntro
          open={introOpen || voice.picking.asking}
          step={introOpen ? "intro" : "voice"}
          language={voice.language}
          voice={voice.picking}
          onClose={() => {
            setIntroOpen(false)
            voice.picking.stopAsking()
          }}
          onContinue={() => {
            voice.picking.ask()
            setIntroOpen(false)
          }}
          onNeverShow={() => {
            hideIntro()
            voice.picking.ask()
            setIntroOpen(false)
          }}
          onStart={() => {
            voice.picking.stopAsking()
            void live?.start()
          }}
        />
      )}
    </form>
  )
}
