"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ClockIcon,
  EllipsisVerticalIcon,
  PlusIcon,
  Trash2Icon,
  UsersIcon,
} from "@/components/ui/icons"
import { toast } from "sonner"

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
  FieldError,
  FieldGroup,
  FieldLabel,
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
import { initials } from "@/lib/initials"
import {
  createTeamMember,
  deleteTeamMember,
  renameTeamMember,
  reorderTeam,
} from "../api/actions"
import { removeTeamMemberPhoto, setTeamMemberPhoto } from "../api/photo-actions"
import { PhotoField } from "./photo-upload"
import { noAutofill } from "@/lib/no-autofill"
import { useOwnerMessages } from "../i18n/provider"

interface MemberRow {
  id: string
  name: string
  photoUrl: string | null
}

const MEMBER_FORM = "member-form"

// Who takes bookings. With two or more, customers can pick who they see.
export function TeamView({
  businessId,
  team,
}: {
  businessId: string
  team: MemberRow[]
}) {
  const router = useRouter()
  const messages = useOwnerMessages()
  const { common: c, team: t } = messages.catalog
  const [editing, setEditing] = useState<MemberRow | "new" | null>(null)
  const [formKey, setFormKey] = useState(0)
  const [pending, startTransition] = useTransition()

  const openForm = (member: MemberRow | "new") => {
    setFormKey((value) => value + 1)
    setEditing(member)
  }
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
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
        <div className="flex gap-2">
          {/* The phone's tab bar has no Hours; the computer's menu does. */}
          <Button
            variant="outline"
            className="md:hidden"
            nativeButton={false}
            render={<Link href={`/dashboard/${businessId}/hours`} />}
          >
            <ClockIcon data-icon="inline-start" />
            {messages.shell.nav.hours}
          </Button>
          <Button onClick={() => openForm("new")}>
            <PlusIcon data-icon="inline-start" />
            {c.add}
          </Button>
        </div>
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
                        onClick={() => remove(member)}
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
            name={editing === "new" ? "" : editing.name}
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
            onSave={(name) =>
              startTransition(async () => {
                const result =
                  editing === "new"
                    ? await createTeamMember(businessId, name)
                    : await renameTeamMember(businessId, editing.id, name)
                if (result.ok) {
                  setEditing(null)
                  toast.success(c.saved)
                  router.refresh()
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
  name: initial,
  photo,
  onSave,
}: {
  name: string
  photo: React.ReactNode
  onSave: (name: string) => void
}) {
  const c = useOwnerMessages().catalog.common
  const [name, setName] = useState(initial)
  const [invalid, setInvalid] = useState(false)
  return (
    <form
      id={MEMBER_FORM}
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        if (!name.trim()) return setInvalid(true)
        onSave(name.trim())
      }}
    >
      <FieldGroup>
        {photo}
        <Field data-invalid={invalid || undefined}>
          <FieldLabel htmlFor="member-name">{c.name}</FieldLabel>
          <Input
            {...noAutofill("member_name")}
            id="member-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
            aria-invalid={invalid || undefined}
          />
          {invalid && <FieldError>{c.addName}</FieldError>}
        </Field>
      </FieldGroup>
    </form>
  )
}
