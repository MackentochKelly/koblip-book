"use client"

import { toast } from "sonner"

import { HelperLine } from "@/components/helper-line"
import { PageSection } from "@/components/page-section"
import { ResponsivePanel } from "@/components/responsive-panel"
import { Button } from "@/components/ui/button"
import { AudioLinesIcon } from "@/components/ui/icons"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { Spinner } from "@/components/ui/spinner"
import type { PageLanguage } from "@/lib/page-language"
import { assistantMessagesFor } from "../i18n"
import { useVoiceChoice } from "../hooks/use-voice-choice"
import type { VoiceChoice } from "../types"
import { VoiceList } from "./voice-list"
import { VoicePreview } from "./voice-preview"

// Settings → Account: the voice that talks live, changed in the same list
// the first live talk asks with.
export function VoiceSection({
  language,
  voiceChoice,
}: {
  language: PageLanguage
  voiceChoice: VoiceChoice
}) {
  const t = assistantMessagesFor(language).voice
  const voice = useVoiceChoice(voiceChoice)
  const name = voice.voices?.find(
    ({ voiceId }) => voiceId === voice.chosen
  )?.name
  const choose = (voiceId: string) =>
    void voice.choose(voiceId).then((saved) => {
      if (saved) {
        toast.success(t.saved)
        voice.stopAsking()
      } else {
        toast.error(t.notSaved)
      }
    })

  return (
    <PageSection id="voice" title={t.setting}>
      <Item variant="outline">
        <ItemMedia variant="icon">
          <AudioLinesIcon />
        </ItemMedia>
        <ItemContent className="min-w-0">
          <ItemTitle className="max-w-full">
            <span className="truncate">{name ?? t.none}</span>
          </ItemTitle>
          {!voice.voices?.length && (
            <ItemDescription>{t.unavailable}</ItemDescription>
          )}
        </ItemContent>
        <ItemActions>
          <Button
            variant="outline"
            size="sm"
            disabled={!voice.voices?.length || voice.saving}
            onClick={voice.ask}
          >
            {voice.saving && <Spinner data-icon="inline-start" />}
            {voice.chosen ? t.change : t.choose}
          </Button>
        </ItemActions>
      </Item>
      <ResponsivePanel
        open={voice.asking}
        onClose={voice.stopAsking}
        title={t.title}
      >
        <VoicePreview>
          <div className="flex flex-col gap-4">
            <HelperLine>{t.hint}</HelperLine>
            {voice.voices && (
              <VoiceList
                key={language}
                voices={voice.voices}
                chosen={voice.chosen}
                language={language}
                labels={t}
                onChoose={choose}
              />
            )}
          </div>
        </VoicePreview>
      </ResponsivePanel>
    </PageSection>
  )
}
