"use client"

import { toast } from "sonner"
import {
  AudioLinesIcon,
  CircleCheckIcon,
  ShieldCheckIcon,
} from "@/components/ui/icons"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
} from "@/components/ui/item"
import { Spinner } from "@/components/ui/spinner"
import type { PageLanguage } from "@/lib/page-language"
import type { AssistantMessages } from "../i18n"
import type { VoicePicking } from "../hooks/use-voice-choice"
import { VoiceList } from "./voice-list"
import { VoicePreview, VoicePreviewGlobe } from "./voice-preview"

// Shown when the owner taps the voice button, until they pick "Don't show
// again": what talking live does, that changes still need a tap, and that
// the recording is not kept. Continue and "Don't show again" both go on to
// the voice step ("voice") in the same look, and Start talking begins; the
// X only closes. The voice step also opens alone while no voice is chosen.
// The globe moves with the voice sample that is playing.
export function VoiceIntro({
  open,
  step,
  language,
  labels,
  voiceLabels,
  voice,
  onClose,
  onContinue,
  onNeverShow,
  onStart,
}: {
  open: boolean
  step: "intro" | "voice"
  language: PageLanguage
  labels: AssistantMessages["composer"]["voiceIntro"]
  voiceLabels: AssistantMessages["voice"]
  voice: VoicePicking
  onClose: () => void
  onContinue: () => void
  onNeverShow: () => void
  onStart: () => void
}) {
  const rows = [
    { icon: <AudioLinesIcon />, text: labels.speak },
    { icon: <CircleCheckIcon />, text: labels.tap },
    { icon: <ShieldCheckIcon />, text: labels.privacy },
  ]
  const choose = (voiceId: string) =>
    void voice.choose(voiceId).then((saved) => {
      if (!saved) toast.error(voiceLabels.notSaved)
    })
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <VoicePreview>
          <VoicePreviewGlobe className="mx-auto mt-6 size-32" />
          {step === "intro" ? (
            <>
              <DialogHeader className="items-center text-center">
                <DialogTitle className="text-xl">{labels.title}</DialogTitle>
              </DialogHeader>
              <ItemGroup>
                {rows.map((row) => (
                  <Item key={row.text} size="sm">
                    <ItemMedia variant="icon">{row.icon}</ItemMedia>
                    <ItemContent>
                      <ItemDescription className="line-clamp-none">
                        {row.text}
                      </ItemDescription>
                    </ItemContent>
                  </Item>
                ))}
              </ItemGroup>
              <DialogFooter className="flex-col sm:flex-col">
                <Button size="lg" className="w-full" onClick={onContinue}>
                  {labels.continue}
                </Button>
                <Button
                  variant="secondary"
                  size="lg"
                  className="w-full"
                  onClick={onNeverShow}
                >
                  {labels.neverShow}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader className="items-center text-center">
                <DialogTitle className="text-xl">
                  {voiceLabels.title}
                </DialogTitle>
                <DialogDescription>
                  {voice.voices?.length
                    ? voiceLabels.hint
                    : voiceLabels.unavailable}
                </DialogDescription>
              </DialogHeader>
              {voice.voices?.length ? (
                <VoiceList
                  // Back on the app's language whenever it changes.
                  key={language}
                  voices={voice.voices}
                  chosen={voice.chosen}
                  language={language}
                  labels={voiceLabels}
                  onChoose={choose}
                  // Only the list scrolls, so the globe and Start talking
                  // stay in view (like ResponsivePanel's body).
                  listClassName="-mx-6 w-auto max-h-[40dvh] scroll-fade overflow-y-auto overscroll-contain px-6"
                />
              ) : null}
              <DialogFooter className="flex-col sm:flex-col">
                <Button
                  size="lg"
                  className="w-full"
                  disabled={!voice.speaks(language) || voice.saving}
                  onClick={onStart}
                >
                  {voice.saving && <Spinner data-icon="inline-start" />}
                  {voiceLabels.start}
                </Button>
              </DialogFooter>
            </>
          )}
        </VoicePreview>
      </DialogContent>
    </Dialog>
  )
}
