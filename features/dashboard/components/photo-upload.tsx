"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ImageIcon } from "@/components/ui/icons"
import { toast } from "sonner"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { useOwnerMessages } from "@/features/dashboard/i18n/provider"
import type { OwnerMessages } from "@/features/dashboard/i18n"
import { resizeImage } from "@/lib/resize-image"
import { UPLOAD_RULES } from "@/lib/upload-rules"
import type { PhotoError, PhotoResult } from "../media-types"

const ACCEPT = Object.keys(UPLOAD_RULES.types).join(",")

function photoErrors(m: OwnerMessages): Record<PhotoError, string> {
  const t = m.settings.photos
  return {
    not_found: m.settings.tryAgain,
    missing: t.pick,
    too_big: t.tooBig,
    wrong_type: t.wrongType,
    limit: t.limit(UPLOAD_RULES.maxBusinessPhotos),
  }
}

// Picks a photo, makes it smaller in the browser and sends it as the
// "file" field. `pick()` opens the phone's photo library or camera.
export function usePhotoUpload<T extends object>(
  upload: (formData: FormData) => Promise<PhotoResult<T>>,
  onDone?: (result: T) => void
) {
  const m = useOwnerMessages()
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [pending, startTransition] = useTransition()

  const send = (file: File) =>
    startTransition(async () => {
      const formData = new FormData()
      formData.set("file", await resizeImage(file))
      const result = await upload(formData).catch(
        () => ({ ok: false, error: "not_found" }) as const
      )
      if (result.ok) {
        onDone?.(result)
        router.refresh()
      } else {
        toast.error(photoErrors(m)[result.error])
      }
    })

  const field = (
    <Input
      ref={input}
      type="file"
      accept={ACCEPT}
      hidden
      onChange={(event) => {
        const file = event.target.files?.[0]
        event.target.value = ""
        if (file) send(file)
      }}
    />
  )
  return { pick: () => input.current?.click(), pending, field }
}

// One photo (a service's or a person's): the picture, then Upload or
// Change, and Remove. Each change is saved right away.
export function PhotoField({
  label,
  photoUrl,
  fallback,
  upload,
  remove,
}: {
  label: string
  photoUrl: string | null
  fallback?: React.ReactNode
  upload: (formData: FormData) => Promise<PhotoResult<{ photoUrl: string }>>
  remove: () => Promise<PhotoResult>
}) {
  const m = useOwnerMessages()
  const router = useRouter()
  const [url, setUrl] = useState(photoUrl)
  const [removing, startRemoving] = useTransition()
  const { pick, pending, field } = usePhotoUpload(upload, (result) =>
    setUrl(result.photoUrl)
  )

  return (
    <PhotoRow
      label={label}
      url={url}
      fallback={fallback}
      pending={pending}
      busy={pending || removing}
      onPick={pick}
      onRemove={() =>
        startRemoving(async () => {
          const result = await remove().catch(
            () => ({ ok: false, error: "not_found" }) as const
          )
          if (result.ok) {
            setUrl(null)
            router.refresh()
          } else {
            toast.error(photoErrors(m)[result.error])
          }
        })
      }
      field={field}
    />
  )
}

// The same photo row for something not saved yet (a person being added):
// the picked photo stays in the form, made smaller, until the form saves
// it with uploadPickedPhoto.
export function PickedPhotoField({
  label,
  fallback,
  onChange,
}: {
  label: string
  fallback?: React.ReactNode
  onChange: (file: File | null) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [pending, startTransition] = useTransition()
  const [url, setUrl] = useState<string | null>(null)
  // The preview lives until the next photo replaces it or the form closes.
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url)
  }, [url])
  const choose = (next: File | null) => {
    setUrl(next ? URL.createObjectURL(next) : null)
    onChange(next)
  }

  return (
    <PhotoRow
      label={label}
      url={url}
      fallback={fallback}
      pending={pending}
      busy={pending}
      onPick={() => input.current?.click()}
      onRemove={() => choose(null)}
      field={
        <Input
          ref={input}
          type="file"
          accept={ACCEPT}
          hidden
          onChange={(event) => {
            const picked = event.target.files?.[0]
            event.target.value = ""
            if (picked)
              startTransition(async () => choose(await resizeImage(picked)))
          }}
        />
      }
    />
  )
}

// Sends a photo picked with PickedPhotoField once its owner is saved.
// Shows why when it is refused; answers whether it was saved.
export function useUploadPickedPhoto() {
  const m = useOwnerMessages()
  return async (
    file: File,
    upload: (formData: FormData) => Promise<PhotoResult<object>>
  ) => {
    const formData = new FormData()
    formData.set("file", file)
    const result = await upload(formData).catch(
      () => ({ ok: false, error: "not_found" }) as const
    )
    if (!result.ok) toast.error(photoErrors(m)[result.error])
    return result.ok
  }
}

function PhotoRow({
  label,
  url,
  fallback,
  pending,
  busy,
  onPick,
  onRemove,
  field,
}: {
  label: string
  url: string | null
  fallback?: React.ReactNode
  pending: boolean
  busy: boolean
  onPick: () => void
  onRemove: () => void
  field: React.ReactNode
}) {
  const m = useOwnerMessages()
  return (
    <div className="flex items-center gap-4">
      <Avatar size="lg" aria-label={label}>
        {url && <AvatarImage src={url} alt="" />}
        <AvatarFallback>{fallback ?? <ImageIcon />}</AvatarFallback>
      </Avatar>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={onPick}
        >
          {pending && <Spinner data-icon="inline-start" />}
          {url ? m.settings.photos.change : m.settings.photos.addPhoto}
        </Button>
        {url && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={onRemove}
          >
            {m.settings.photos.remove}
          </Button>
        )}
      </div>
      {field}
    </div>
  )
}
