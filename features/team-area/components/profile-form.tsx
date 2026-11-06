"use client"

import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ExternalLinkIcon, LogOutIcon } from "@/components/ui/icons"
import { toast } from "sonner"

import { AppSelect } from "@/components/app-select"
import { PhotoField } from "@/components/photo-upload"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { authClient } from "@/lib/auth-client"
import { LOGIN_PATH } from "@/lib/auth-links"
import { BOOKING_RULES } from "@/lib/booking-rules"
import { initials } from "@/lib/initials"
import {
  checkStartingCounts,
  languageName,
  TEAM_RULES,
  type StartingCounts,
  type TeamProfile,
} from "@/lib/team-rules"
import { removeMyPhoto, saveMyProfile, setMyPhoto } from "../api/actions"

// What customers see on the team member's public profile, which they keep
// up themselves: their photo, job title, about, languages and their
// numbers from before Koblip. Their name is the owner's.
export function ProfileForm({
  teamMemberId,
  name,
  photoUrl,
  publicHref,
  profile,
}: {
  teamMemberId: string
  name: string
  photoUrl: string | null
  publicHref: string
  profile: TeamProfile & StartingCounts
}) {
  const p = useTranslations("teamArea.profile")
  const locale = useLocale()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [description, setDescription] = useState(profile.description ?? "")
  const [about, setAbout] = useState(profile.about ?? "")
  const [languages, setLanguages] = useState(profile.languages)
  // Kept as typed; empty counts as 0.
  const [pastAppointments, setPastAppointments] = useState(String(profile.pastAppointments))
  const [pastClients, setPastClients] = useState(String(profile.pastClients))
  const counts = {
    pastAppointments: Number(pastAppointments || 0),
    pastClients: Number(pastClients || 0),
  }
  const countsOk = checkStartingCounts(counts).ok
  const changed =
    description !== (profile.description ?? "") ||
    about !== (profile.about ?? "") ||
    languages.join() !== profile.languages.join() ||
    counts.pastAppointments !== profile.pastAppointments ||
    counts.pastClients !== profile.pastClients
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col items-start gap-4">
        <div className="flex min-w-0 flex-col items-start gap-1">
          <p className="truncate text-lg font-semibold">{name}</p>
          <Button
            variant="link"
            className="h-auto p-0"
            nativeButton={false}
            render={<Link href={publicHref} target="_blank" />}
          >
            {p("seePublic")}
            <ExternalLinkIcon data-icon="inline-end" />
          </Button>
        </div>
        <PhotoField
          label={p("photo", { name })}
          photoUrl={photoUrl}
          fallback={initials(name)}
          upload={(formData) => setMyPhoto(teamMemberId, formData)}
          remove={() => removeMyPhoto(teamMemberId)}
        />
      </div>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          startTransition(async () => {
            const result = await saveMyProfile(teamMemberId, {
              description,
              about,
              languages,
              ...counts,
            }).catch(() => null)
            if (result?.ok) {
              toast.success(p("saved"))
              router.refresh()
            } else {
              toast.error(p("failed"))
            }
          })
        }}
      >
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="my-title">{p("jobTitle")}</FieldLabel>
            <Input
              id="my-title"
              className="min-h-11 md:min-h-9"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={BOOKING_RULES.maxTeamDescription}
              placeholder={p("optional")}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="my-about">{p("about")}</FieldLabel>
            <Textarea
              id="my-about"
              value={about}
              onChange={(event) => setAbout(event.target.value)}
              maxLength={TEAM_RULES.aboutMaxLength}
              placeholder={p("optional")}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="my-languages">{p("languages")}</FieldLabel>
            <AppSelect
              multiple
              id="my-languages"
              options={TEAM_RULES.languages.map((code) => ({
                value: code,
                label: languageName(code, locale),
                disabled:
                  languages.length >= TEAM_RULES.maxLanguages &&
                  !languages.includes(code),
              }))}
              value={languages}
              onValueChange={setLanguages}
              placeholder={p("optional")}
              className="w-full"
            />
          </Field>
          <FieldSet>
            <FieldLegend variant="label">{p("before.title")}</FieldLegend>
            <FieldDescription>{p("before.note")}</FieldDescription>
            <div className="grid grid-cols-2 gap-3">
              <Field data-invalid={!countsOk || undefined}>
                <FieldLabel htmlFor="my-past-appointments">{p("before.appointments")}</FieldLabel>
                <Input
                  id="my-past-appointments"
                  className="min-h-11 md:min-h-9"
                  inputMode="numeric"
                  maxLength={String(TEAM_RULES.startingCounts.highest).length}
                  value={pastAppointments}
                  onChange={(event) => setPastAppointments(event.target.value.replace(/\D/g, ""))}
                  aria-invalid={!countsOk || undefined}
                />
              </Field>
              <Field data-invalid={!countsOk || undefined}>
                <FieldLabel htmlFor="my-past-clients">{p("before.clients")}</FieldLabel>
                <Input
                  id="my-past-clients"
                  className="min-h-11 md:min-h-9"
                  inputMode="numeric"
                  maxLength={String(TEAM_RULES.startingCounts.highest).length}
                  value={pastClients}
                  onChange={(event) => setPastClients(event.target.value.replace(/\D/g, ""))}
                  aria-invalid={!countsOk || undefined}
                />
              </Field>
            </div>
            {!countsOk && <FieldError>{p("before.error")}</FieldError>}
            <Button
              type="button"
              variant="outline"
              className="self-start"
              disabled={counts.pastAppointments === 0 && counts.pastClients === 0}
              onClick={() => {
                setPastAppointments("0")
                setPastClients("0")
              }}
            >
              {p("before.reset")}
            </Button>
          </FieldSet>
          <Button type="submit" size="lg" disabled={pending || !changed || !countsOk}>
            {pending && <Spinner data-icon="inline-start" />}
            {p("save")}
          </Button>
        </FieldGroup>
      </form>
      <Button
        variant="outline"
        size="lg"
        onClick={() =>
          authClient.signOut({ fetchOptions: { onSuccess: () => router.replace(LOGIN_PATH) } })
        }
      >
        <LogOutIcon data-icon="inline-start" />
        {p("logOut")}
      </Button>
    </div>
  )
}
