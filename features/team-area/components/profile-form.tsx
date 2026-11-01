"use client"

import Link from "next/link"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ExternalLinkIcon, LogOutIcon } from "@/components/ui/icons"
import { toast } from "sonner"

import { MultiPick } from "@/components/multi-pick"
import { PhotoField } from "@/components/photo-upload"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { authClient } from "@/lib/auth-client"
import { BOOKING_RULES } from "@/lib/booking-rules"
import { initials } from "@/lib/initials"
import { languageName, TEAM_RULES, type TeamProfile } from "@/lib/team-rules"
import { removeMyPhoto, saveMyProfile, setMyPhoto } from "../api/actions"
import { useTeamAreaWords } from "../i18n/provider"

// What customers see on the team member's public profile, which they keep
// up themselves: their photo, job title, about and languages. Their name
// is the owner's.
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
  profile: TeamProfile
}) {
  const t = useTeamAreaWords()
  const p = t.profile
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [description, setDescription] = useState(profile.description ?? "")
  const [about, setAbout] = useState(profile.about ?? "")
  const [languages, setLanguages] = useState(profile.languages)
  const changed =
    description !== (profile.description ?? "") ||
    about !== (profile.about ?? "") ||
    languages.join() !== profile.languages.join()
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
            {p.seePublic}
            <ExternalLinkIcon data-icon="inline-end" />
          </Button>
        </div>
        <PhotoField
          label={p.photo(name)}
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
            }).catch(() => null)
            if (result?.ok) {
              toast.success(p.saved)
              router.refresh()
            } else {
              toast.error(p.failed)
            }
          })
        }}
      >
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="my-title">{p.jobTitle}</FieldLabel>
            <Input
              id="my-title"
              className="min-h-11 md:min-h-9"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={BOOKING_RULES.maxTeamDescription}
              placeholder={p.optional}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="my-about">{p.about}</FieldLabel>
            <Textarea
              id="my-about"
              value={about}
              onChange={(event) => setAbout(event.target.value)}
              maxLength={TEAM_RULES.aboutMaxLength}
              placeholder={p.optional}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="my-languages">{p.languages}</FieldLabel>
            <MultiPick
              id="my-languages"
              items={TEAM_RULES.languages.map((code) => ({
                value: code,
                label: languageName(code, t.locale),
              }))}
              value={languages}
              onChange={(next) => setLanguages(next.slice(0, TEAM_RULES.maxLanguages))}
              placeholder={p.optional}
              empty={p.noLanguage}
            />
          </Field>
          <Button type="submit" size="lg" disabled={pending || !changed}>
            {pending && <Spinner data-icon="inline-start" />}
            {p.save}
          </Button>
        </FieldGroup>
      </form>
      <Button
        variant="outline"
        size="lg"
        onClick={() =>
          authClient.signOut({ fetchOptions: { onSuccess: () => router.replace("/login") } })
        }
      >
        <LogOutIcon data-icon="inline-start" />
        {p.logOut}
      </Button>
    </div>
  )
}
