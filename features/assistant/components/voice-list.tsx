"use client"

import { type Messages, useTranslations } from "next-intl"
import { useState } from "react"

import { ViewTabs } from "@/components/view-tabs"
import { Button } from "@/components/ui/button"
import { CheckIcon, PauseIcon, PlayIcon } from "@/components/ui/icons"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item"
import { PAGE_LANGUAGES, type PageLanguage } from "@/lib/page-language"
import { cn } from "@/lib/utils"
import type { VoiceOption } from "../types"
import { useVoicePreview } from "./voice-preview"

// The ElevenLabs labels the app has its own words for.
type VoiceLabel = keyof Messages["assistant"]["voice"]["labels"]

// The voices, with a tab for each language they speak in their samples
// (starting on the owner's). A tap on a row chooses the voice and plays its
// sample; the play button on the right only plays or stops it. The whole
// row is the choose button (stretched over it with ::after), with the play
// button above it as its own control, like SwitchCard. Needs a VoicePreview.
// Give it key={language} so the tabs go back to the app's language when
// that changes.
// listClassName: for a list that scrolls on its own below the tabs.
export function VoiceList({
  voices,
  chosen,
  language,
  onChoose,
  listClassName,
}: {
  voices: VoiceOption[]
  chosen: string | null
  language: PageLanguage
  onChoose: (voiceId: string) => void
  listClassName?: string
}) {
  const t = useTranslations("assistant.voice")
  const preview = useVoicePreview()
  const spoken = PAGE_LANGUAGES.filter((item) =>
    voices.some((voice) => voice.previews[item])
  )
  const [picked, setPicked] = useState(language)
  const shown = spoken.includes(picked) ? picked : (spoken[0] ?? language)
  // ElevenLabs' label in the owner's words, or as it comes.
  const isVoiceLabel = (value: string): value is VoiceLabel =>
    t.has(`labels.${value as VoiceLabel}`)
  const word = (value: string | undefined) =>
    value &&
    (isVoiceLabel(value) ? t(`labels.${value}`) : value.replaceAll("_", " "))
  // ElevenLabs names often carry a tagline ("Adam - Engaging, Friendly");
  // the row shows the name alone, with the accent and gender under it.
  const shortName = (name: string) => name.split(/\s[-–]\s/)[0] || name

  return (
    <div className="flex flex-col gap-3">
      {spoken.length > 1 && (
        <ViewTabs
          views={spoken.map((id) => ({ id, label: t(`languages.${id}`) }))}
          value={shown}
          onChange={(next) => {
            void preview.pause()
            setPicked(next)
          }}
          ariaLabel={t("language")}
          className="items-center"
        />
      )}
      <ItemGroup className={listClassName}>
        {voices.flatMap((voice) => {
          const src = voice.previews[shown]
          if (!src) return []
          const id = `${voice.voiceId}:${shown}`
          const playing = preview.isPlaying(id)
          const selected = voice.voiceId === chosen
          const details = [voice.labels.accent, voice.labels.gender]
            .map(word)
            .filter(Boolean)
            .join(" · ")
          return [
            <Item
              key={id}
              size="xs"
              className={cn(
                "relative has-[[data-slot=item-content]_button:hover]:bg-muted",
                selected && "bg-muted"
              )}
            >
              <ItemContent className="min-w-0">
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    onChoose(voice.voiceId)
                    if (!playing) preview.play(id, src)
                  }}
                  className="flex min-h-11 min-w-0 flex-col items-start justify-center gap-0.5 rounded-md text-left outline-none after:absolute after:inset-0 after:rounded-2xl focus-visible:after:ring-3 focus-visible:after:ring-ring/50"
                >
                  <ItemTitle className="max-w-full">
                    <span className="truncate">{shortName(voice.name)}</span>
                  </ItemTitle>
                  {details && <ItemDescription>{details}</ItemDescription>}
                </button>
              </ItemContent>
              <ItemActions className="relative z-10">
                {selected && <CheckIcon className="text-primary" />}
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={t(playing ? "pause" : "play", {
                    name: shortName(voice.name),
                  })}
                  onClick={() =>
                    playing ? void preview.pause() : preview.play(id, src)
                  }
                >
                  {playing ? <PauseIcon /> : <PlayIcon />}
                </Button>
              </ItemActions>
            </Item>,
          ]
        })}
      </ItemGroup>
    </div>
  )
}
