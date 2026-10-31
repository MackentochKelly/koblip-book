"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowDownIcon,
  ArrowUpIcon,
  EllipsisVerticalIcon,
  PlusIcon,
  Trash2Icon,
  UsersIcon,
} from "@/components/ui/icons"
import { toast } from "sonner"

import { WeeklyHoursEditor } from "@/components/weekly-hours-editor"
import { Switch } from "@/components/ui/switch"
import { validHours, type HoursRow } from "@/lib/hours-rules"
import {
  saveTeamMemberWithHours,
  type TeamMemberDetails,
} from "../api/member-hours"
import { ResponsivePanel } from "@/components/responsive-panel"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Field,
  FieldContent,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { Spinner } from "@/components/ui/spinner"
import { BOOKING_RULES, EMAIL_PATTERN, PHONE_PATTERN } from "@/lib/booking-rules"
import { initials } from "@/lib/initials"
import {
  deleteTeamMember,
  reorderTeam,
} from "../api/actions"
import { removeTeamMemberPhoto, setTeamMemberPhoto } from "../api/photo-actions"
import {
  PhotoField,
  PickedPhotoField,
  useUploadPickedPhoto,
} from "./photo-upload"
import { useTabBarAction } from "./tab-bar-action"
import { noAutofill } from "@/lib/no-autofill"
import { useOwnerMessages } from "../i18n/provider"
import { ConfirmRemove } from "./confirm-remove"

interface MemberRow {
  id: string
  name: string
  photoUrl: string | null
  phone: string | null
  email: string | null
  description: string | null
}

type DetailsError = "name" | "phone" | "email"

const MEMBER_FORM = "member-form"

// Who takes bookings. With two or more, customers can pick who they see.
export function TeamView({
  businessId,
  team,
  hours,
  memberHours,
}: {
  businessId: string
  hours: HoursRow[]
  memberHours: (HoursRow & { teamMemberId: string })[]
  team: MemberRow[]
}) {
  const router = useRouter()
  const messages = useOwnerMessages()
  const { common: c, team: t } = messages.catalog
  const [editing, setEditing] = useState<MemberRow | "new" | null>(null)
  const [formKey, setFormKey] = useState(0)
  const [removing, setRemoving] = useState<MemberRow | null>(null)
  const [pending, startTransition] = useTransition()
  const [formError, setFormError] = useState<DetailsError | null>(null)
  const uploadPickedPhoto = useUploadPickedPhoto()

  const openForm = (member: MemberRow | "new") => {
    setFormKey((value) => value + 1)
    setFormError(null)
    setEditing(member)
  }
  // On a phone the tab bar's middle button adds a person.
  useTabBarAction({ label: t.addPerson, onClick: () => openForm("new") })
  const move = (index: number, by: number) => {
    const ids = team.map((member) => member.id)
    const [id] = ids.splice(index, 1)
    ids.splice(index + by, 0, id)
    startTransition(async () => {
      const result = await reorderTeam(businessId, ids)
      if (result.ok) router.refresh()
      else toast.error(c.failed)
    })
  }
  const remove = (member: MemberRow) =>
    startTransition(async () => {
      const result = await deleteTeamMember(businessId, member.id)
      if (result.ok) {
        toast.success(t.removed(member.name))
        router.refresh()
      } else if (result.error === "has_bookings") {
        toast.error(t.hasBookings(member.name))
      } else {
        toast.error(c.failed)
      }
    })

  return (
    <div className="flex flex-col gap-6">
      {/* On a phone the top bar names the page and Add is the tab bar's
          middle button, so this header row is a computer's. */}
      <div className="flex items-center justify-between gap-3 max-md:contents">
        <h1 className="text-2xl font-semibold tracking-tight max-md:sr-only">{t.title}</h1>
        <Button className="max-md:hidden" onClick={() => openForm("new")}>
          <PlusIcon data-icon="inline-start" />
          {c.add}
        </Button>
      </div>

      {team.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UsersIcon />
            </EmptyMedia>
            <EmptyTitle>{t.empty}</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : (
        <ItemGroup className="gap-3">
          {team.map((member, index) => (
            <Item key={member.id} variant="outline">
              <ItemMedia>
                <Avatar>
                  {member.photoUrl && (
                    <AvatarImage src={member.photoUrl} alt="" />
                  )}
                  <AvatarFallback>{initials(member.name)}</AvatarFallback>
                </Avatar>
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{member.name}</ItemTitle>
              </ItemContent>
              <ItemActions>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openForm(member)}
                >
                  {c.edit}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="outline"
                        size="icon-sm"
                        aria-label={c.more}
                      />
                    }
                  >
                    <EllipsisVerticalIcon />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuGroup>
                      <DropdownMenuItem
                        disabled={index === 0 || pending}
                        onClick={() => move(index, -1)}
                      >
                        <ArrowUpIcon />
                        {c.moveUp}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={index === team.length - 1 || pending}
                        onClick={() => move(index, 1)}
                      >
                        <ArrowDownIcon />
                        {c.moveDown}
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                      <DropdownMenuItem
                        variant="destructive"
                        disabled={pending}
                        onClick={() => setRemoving(member)}
                      >
                        <Trash2Icon />
                        {c.remove}
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </ItemActions>
            </Item>
          ))}
        </ItemGroup>
      )}

      <ConfirmRemove
        name={removing?.name ?? null}
        onClose={() => setRemoving(null)}
        onConfirm={() => removing && remove(removing)}
      />

      <ResponsivePanel
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? t.addPerson : t.editPerson}
        footer={
          <Button type="submit" size="lg" form={MEMBER_FORM} disabled={pending}>
            {pending && <Spinner data-icon="inline-start" />}
            {c.save}
          </Button>
        }
      >
        {editing !== null && (
          <MemberForm
            key={formKey}
            hours={hours}
            memberHours={editing === "new" ? [] : memberHours.filter((row) => row.teamMemberId === editing.id)}
            member={editing === "new" ? null : editing}
            error={formError}
            onError={setFormError}
            photo={
              editing !== "new" && (
                <PhotoField
                  label={t.photo(editing.name)}
                  photoUrl={editing.photoUrl}
                  fallback={initials(editing.name)}
                  upload={(formData) =>
                    setTeamMemberPhoto(businessId, editing.id, formData)
                  }
                  remove={() => removeTeamMemberPhoto(businessId, editing.id)}
                />
              )
            }
            onSave={(details, rows, photo) =>
              startTransition(async () => {
                const result = await saveTeamMemberWithHours(businessId, editing === "new" ? null : editing.id, details, rows).catch(() => null)
                if (result?.ok) {
                  // A photo picked while adding goes up once the person exists.
                  if (photo)
                    await uploadPickedPhoto(photo, (formData) =>
                      setTeamMemberPhoto(businessId, result.id, formData)
                    )
                  setEditing(null)
                  toast.success(c.saved)
                  router.refresh()
                } else if (
                  result?.error === "name" ||
                  result?.error === "phone" ||
                  result?.error === "email"
                ) {
                  setFormError(result.error)
                } else {
                  toast.error(t.saveFailed)
                }
              })
            }
          />
        )}
      </ResponsivePanel>
    </div>
  )
}

function MemberForm({
  member,
  hours,
  memberHours,
  photo,
  error,
  onError,
  onSave,
}: {
  member: MemberRow | null // null while adding
  hours: HoursRow[]
  memberHours: HoursRow[]
  photo: React.ReactNode
  error: DetailsError | null
  onError: (error: DetailsError) => void
  onSave: (
    details: TeamMemberDetails,
    rows: HoursRow[] | null,
    photo: File | null
  ) => void
}) {
  const m = useOwnerMessages()
  const c = m.catalog.common
  const t = m.catalog.team
  const [same, setSame] = useState(memberHours.length === 0)
  const [rows, setRows] = useState(memberHours.length ? memberHours : hours)
  const [hoursInvalid, setHoursInvalid] = useState(false)
  const [name, setName] = useState(member?.name ?? "")
  const [phone, setPhone] = useState(member?.phone ?? "")
  const [email, setEmail] = useState(member?.email ?? "")
  const [description, setDescription] = useState(member?.description ?? "")
  const [newPhoto, setNewPhoto] = useState<File | null>(null)
  return (
    <form
      id={MEMBER_FORM}
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        if (!name.trim()) return onError("name")
        if (phone.trim() && !PHONE_PATTERN.test(phone.trim()))
          return onError("phone")
        if (email.trim() && !EMAIL_PATTERN.test(email.trim()))
          return onError("email")
        if (!same && (!validHours(rows) || rows.length === 0)) { setHoursInvalid(true); return }
        onSave(
          { name: name.trim(), phone, email, description },
          same ? null : rows,
          member ? null : newPhoto
        )
      }}
    >
      <FieldGroup>
        {member ? (
          photo
        ) : (
          <PickedPhotoField
            label={t.newPhoto}
            fallback={name.trim() ? initials(name) : undefined}
            onChange={setNewPhoto}
          />
        )}
        <Field data-invalid={error === "name" || undefined}>
          <FieldLabel htmlFor="member-name">{c.name}</FieldLabel>
          <Input
            {...noAutofill("member_name")}
            id="member-name"
            className="min-h-11 md:min-h-9"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={BOOKING_RULES.maxTeamName}
            aria-invalid={error === "name" || undefined}
          />
          {error === "name" && <FieldError>{c.addName}</FieldError>}
        </Field>
        <Field data-invalid={error === "phone" || undefined}>
          <FieldLabel htmlFor="member-phone">{t.phone}</FieldLabel>
          <Input
            {...noAutofill("member_phone")}
            id="member-phone"
            type="tel"
            inputMode="tel"
            className="min-h-11 md:min-h-9"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder={c.optional}
            aria-invalid={error === "phone" || undefined}
          />
          {error === "phone" && <FieldError>{t.badPhone}</FieldError>}
        </Field>
        <Field data-invalid={error === "email" || undefined}>
          <FieldLabel htmlFor="member-email">{t.email}</FieldLabel>
          <Input
            {...noAutofill("member_email")}
            id="member-email"
            type="email"
            inputMode="email"
            className="min-h-11 md:min-h-9"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            maxLength={BOOKING_RULES.maxEmail}
            placeholder={c.optional}
            aria-invalid={error === "email" || undefined}
          />
          {error === "email" && <FieldError>{t.badEmail}</FieldError>}
        </Field>
        <Field>
          <FieldLabel htmlFor="member-description">{t.description}</FieldLabel>
          <Input
            {...noAutofill("member_description")}
            id="member-description"
            className="min-h-11 md:min-h-9"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={BOOKING_RULES.maxTeamDescription}
            placeholder={c.optional}
          />
        </Field>
        <FieldSet>
          <FieldLegend variant="label">{t.workingHours}</FieldLegend>
          <Field orientation="horizontal" className="min-h-11">
            <FieldContent>
              <FieldLabel htmlFor="member-same-hours">{t.sameHours}</FieldLabel>
            </FieldContent>
            <Switch id="member-same-hours" checked={same} onCheckedChange={setSame} />
          </Field>
          {!same && <WeeklyHoursEditor rows={rows} onChange={(next) => { setRows(next); setHoursInvalid(false) }} locale={m.locale} labels={m.settings.hours} />}
          {hoursInvalid && <FieldError>{rows.length === 0 ? t.hoursRequired : m.settings.hours.fillEvery}</FieldError>}
        </FieldSet>
      </FieldGroup>
    </form>
  )
}
