"use client"

import { toast } from "sonner"
import {
  AudioLinesIcon,
  CircleCheckIcon,
  ShieldCheckIcon,
} from "@/components/ui/icons"

import { VoiceGlobe } from "@/components/voice-globe"
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
import type { AssistantMessages } from "../i18n"
import type { VoicePicking } from "../hooks/use-voice-choice"
import { VoiceList } from "./voice-list"

// Shown when the owner taps the voice button, until they pick "Don't show
// again": what talking live does, that changes still need a tap, and that
// the recording is not kept. Continue and "Don't show again" both go on;
// the X only closes. With no voice chosen yet, the same dialog then asks
// for one ("voice"), and Start talking begins.
export function VoiceIntro({
  open,
  step,
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
        {step === "intro" ? (
          <>
            <VoiceGlobe className="mx-auto mt-6 size-32" />
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
            <DialogHeader>
              <DialogTitle className="text-xl">{voiceLabels.title}</DialogTitle>
              <DialogDescription>
                {voice.voices?.length
                  ? voiceLabels.hint
                  : voiceLabels.unavailable}
              </DialogDescription>
            </DialogHeader>
            {voice.voices?.length ? (
              <VoiceList
                voices={voice.voices}
                chosen={voice.chosen}
                labels={voiceLabels}
                onChoose={choose}
              />
            ) : null}
            <DialogFooter>
              <Button
                size="lg"
                className="w-full"
                disabled={!voice.chosen || voice.saving}
                onClick={onStart}
              >
                {voice.saving && <Spinner data-icon="inline-start" />}
                {voiceLabels.start}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
