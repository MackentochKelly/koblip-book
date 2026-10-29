"use client"

import {
  AudioLinesIcon,
  CircleCheckIcon,
  ShieldCheckIcon,
} from "@/components/ui/icons"

import { HeroGradient } from "@/components/hero-gradient"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
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
import type { AssistantMessages } from "../i18n"

// Shown when the owner taps the voice button, until they pick "Don't show
// again": what talking live does, that changes still need a tap, and that
// the recording is not kept. Continue and "Don't show again" both start
// talking; the X only closes.
export function VoiceIntro({
  open,
  labels,
  onClose,
  onContinue,
  onNeverShow,
}: {
  open: boolean
  labels: AssistantMessages["composer"]["voiceIntro"]
  onClose: () => void
  onContinue: () => void
  onNeverShow: () => void
}) {
  const rows = [
    { icon: <AudioLinesIcon />, text: labels.speak },
    { icon: <CircleCheckIcon />, text: labels.tap },
    { icon: <ShieldCheckIcon />, text: labels.privacy },
  ]
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <div
          aria-hidden
          className="relative isolate mx-auto mt-6 size-32 overflow-hidden rounded-full"
        >
          <HeroGradient />
        </div>
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
      </DialogContent>
    </Dialog>
  )
}
