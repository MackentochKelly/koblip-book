"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { HelperLine } from "@/components/helper-line"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { RefreshIcon } from "@/components/ui/icons"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import {
  resetTranslationToGoogle,
  retryFailedTranslation,
  saveTranslationText,
  type TranslationActionResult,
} from "../api/translation-actions"
import type { TranslationDetail } from "../api/translations"
import { useAdminMessages } from "../i18n/provider"
import { stateBadge, textLabels } from "../utils/translation-labels"
import { TranslationHistoryList } from "./translation-history-list"

type Problem = Exclude<TranslationActionResult, { ok: true }>["error"]

// Admin → Translations → one text (G5): its English, the translation to
// edit (fields, links and emails stay as in English), Reset to Google and,
// when Google failed, Try again; then everything that happened to it.
export function TranslationEntry({ detail }: { detail: TranslationDetail }) {
  const m = useAdminMessages()
  const t = m.translations
  const router = useRouter()
  const { entry, history } = detail
  const [draft, setDraft] = useState(entry.text ?? "")
  const [problem, setProblem] = useState<Problem | null>(null)
  const [asking, setAsking] = useState(false)
  const [pending, startTransition] = useTransition()
  const labels = textLabels(entry, m)
  const fieldId = `translation-${entry.id}`
  // Saving the same words marks a translation that needs review as checked.
  const canSave =
    draft.trim() !== "" &&
    (draft.trim() !== (entry.text ?? "") || entry.status === "needs_review")
  const edited = entry.status === "edited" || entry.status === "needs_review"

  function run(
    action: () => Promise<TranslationActionResult>,
    success: string
  ) {
    startTransition(async () => {
      const result = await action().catch(() => null)
      if (result?.ok) {
        setProblem(null)
        toast.success(success)
        router.refresh()
        return
      }
      const error = result?.ok === false ? result.error : "failed"
      // A problem with the typed words shows under the box; others pop up.
      if (error === "empty" || error === "too_long" || error === "fields") {
        setProblem(error)
      } else {
        toast.error(t.entry.errors[error])
        router.refresh()
      }
    })
  }

  const hint =
    entry.status === "pending" ||
    entry.status === "failed" ||
    entry.status === "needs_review"
      ? t.entry.hints[entry.status]
      : null

  return (
    <div className="flex flex-col gap-6">
      <ItemGroup className="gap-3">
        <Item variant="outline">
          <ItemContent className="min-w-0">
            <ItemTitle>{t.entry.english}</ItemTitle>
            <ItemDescription className="line-clamp-none break-words whitespace-pre-wrap text-foreground">
              {entry.sourceText}
            </ItemDescription>
            <ItemDescription className="truncate">
              {[labels.where, labels.what].join(" · ")}
            </ItemDescription>
          </ItemContent>
          <ItemActions>
            <Badge variant={stateBadge(entry.status)}>
              {t.states[entry.status]}
            </Badge>
          </ItemActions>
        </Item>
      </ItemGroup>

      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          if (!canSave) return
          run(() => saveTranslationText(entry.id, draft), t.entry.saved)
        }}
      >
        <Field data-invalid={problem ? true : undefined}>
          <FieldLabel htmlFor={fieldId}>{labels.language}</FieldLabel>
          <Textarea
            id={fieldId}
            value={draft}
            aria-invalid={problem ? true : undefined}
            onChange={(event) => {
              setDraft(event.target.value)
              setProblem(null)
            }}
          />
          {problem && <FieldError>{t.entry.errors[problem]}</FieldError>}
        </Field>
        {hint && (
          <HelperLine
            more={
              entry.status === "failed" && entry.lastError
                ? t.entry.lastError(entry.lastError)
                : undefined
            }
            moreLabel={t.entry.whyFailed}
          >
            {hint}
          </HelperLine>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending || !canSave}>
            {pending && <Spinner data-icon="inline-start" />}
            {t.entry.save}
          </Button>
          {entry.status === "failed" && (
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() =>
                run(() => retryFailedTranslation(entry.id), t.entry.retried)
              }
            >
              <RefreshIcon data-icon="inline-start" />
              {t.entry.retry}
            </Button>
          )}
          {entry.status !== "pending" && entry.status !== "failed" && (
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() =>
                edited
                  ? setAsking(true)
                  : run(() => resetTranslationToGoogle(entry.id), t.entry.resetDone)
              }
            >
              {t.entry.reset}
            </Button>
          )}
        </div>
      </form>

      <section className="flex flex-col gap-3" aria-labelledby="translation-history">
        <h2
          id="translation-history"
          className="text-lg font-semibold tracking-tight"
        >
          {t.history.title}
        </h2>
        <TranslationHistoryList
          rows={history.map((row) => ({ ...row, kind: "text" as const }))}
          showText={false}
        />
      </section>

      <ConfirmDialog
        open={asking}
        title={t.entry.resetTitle}
        description={t.entry.resetText}
        confirm={t.entry.reset}
        cancel={t.entry.keep}
        onConfirm={() =>
          run(() => resetTranslationToGoogle(entry.id), t.entry.resetDone)
        }
        onClose={() => setAsking(false)}
      />
    </div>
  )
}
