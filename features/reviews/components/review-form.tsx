"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { PageSection } from "@/components/page-section"
import { Rating } from "@/components/rating"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { REVIEW_RULES } from "@/lib/review-rules"
import { saveReview } from "../api/actions"
import type { MyReview } from "../types"
import { StarPicker } from "./star-picker"

// The client's review of one past visit (D15), on the booking's page:
// stars and an optional comment, changed again within `editDays`; after
// that it only shows. Nothing while the visit can't be reviewed.
export function ReviewForm({
  bookingId,
  review: mine,
}: {
  bookingId: string
  review: MyReview
}) {
  const t = useTranslations("reviews")
  const router = useRouter()
  const saved = mine.review
  const [stars, setStars] = useState(saved?.stars ?? 0)
  const [comment, setComment] = useState(saved?.comment ?? "")
  const [pending, startTransition] = useTransition()

  if (!mine.canReview && !saved) return null

  if (saved && !saved.editable) {
    return (
      <PageSection
        id="review"
        title={t("form.title")}
        action={<Rating rating={saved.stars} className="text-sm" />}
      >
        {saved.comment && (
          <p className="text-sm leading-relaxed whitespace-pre-line">
            {saved.comment}
          </p>
        )}
        <p className="text-sm text-muted-foreground">{t("form.tooLate")}</p>
      </PageSection>
    )
  }

  const changed =
    stars !== (saved?.stars ?? 0) ||
    comment.trim() !== (saved?.comment ?? "")

  const submit = () =>
    startTransition(async () => {
      const result = await saveReview(bookingId, stars, comment).catch(
        () => null
      )
      if (result?.ok) {
        toast.success(t("form.saved"))
        router.refresh()
      } else {
        toast.error(
          result?.error === "too_late" ? t("form.tooLate") : t("form.failed")
        )
        router.refresh()
      }
    })

  return (
    <PageSection id="review" title={t("form.title")}>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <FieldGroup>
          <FieldSet>
            <FieldLegend variant="label">{t("form.rate")}</FieldLegend>
            <StarPicker
              value={stars}
              onChange={setStars}
              label={t("form.rate")}
              disabled={pending}
            />
          </FieldSet>
          <Field>
            <FieldLabel htmlFor="review-comment">{t("form.comment")}</FieldLabel>
            <Textarea
              id="review-comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              maxLength={REVIEW_RULES.maxComment}
              disabled={pending}
            />
            <FieldDescription>
              {t("form.commentHelp", { max: REVIEW_RULES.maxComment })}
            </FieldDescription>
          </Field>
          <Button
            type="submit"
            variant="outline"
            size="lg"
            className="self-start"
            disabled={pending || stars === 0 || !changed}
          >
            {pending && <Spinner data-icon="inline-start" />}
            {t("form.save")}
          </Button>
        </FieldGroup>
      </form>
    </PageSection>
  )
}
