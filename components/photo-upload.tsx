"use client"

import { createContext, use, useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ImageIcon } from "@/components/ui/icons"
import { toast } from "sonner"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { resizeImage } from "@/lib/resize-image"
import { UPLOAD_RULES } from "@/lib/upload-rules"
import type { PhotoError, PhotoResult } from "@/types/photo"

const ACCEPT = Object.keys(UPLOAD_RULES.types).join(",")

// The photo buttons' words and why an upload was refused, in the area's
// language: each app area (owner, team member) gives its own once, around
// its pages.
export interface PhotoWords {
  change: string
  addPhoto: string
  remove: string
  errors: Record<PhotoError, string>
}

const PhotoWordsContext = createContext<PhotoWords | null>(null)

export function PhotoWordsProvider({
  words,
  children,
}: {
  words: PhotoWords
  children: React.ReactNode
}) {
  return <PhotoWordsContext value={words}>{children}</PhotoWordsContext>
}

function usePhotoWords(): PhotoWords {
  const words = use(PhotoWordsContext)
  if (!words) throw new Error("Photo fields need a PhotoWordsProvider.")
  return words
}

// Picks a photo, makes it smaller in the browser and sends it as the
// "file" field. `pick()` opens the phone's photo library or camera.
export function usePhotoUpload<T extends object>(
  upload: (formData: FormData) => Promise<PhotoResult<T>>,
  onDone?: (result: T) => void
) {
  const words = usePhotoWords()
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
        toast.error(words.errors[result.error])
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
  const words = usePhotoWords()
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
            toast.error(words.errors[result.error])
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
  const words = usePhotoWords()
  return async (
    file: File,
    upload: (formData: FormData) => Promise<PhotoResult<object>>
  ) => {
    const formData = new FormData()
    formData.set("file", file)
    const result = await upload(formData).catch(
      () => ({ ok: false, error: "not_found" }) as const
    )
    if (!result.ok) toast.error(words.errors[result.error])
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
  const words = usePhotoWords()
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
          disabled={busy}
          onClick={onPick}
        >
          {pending && <Spinner data-icon="inline-start" />}
          {url ? words.change : words.addPhoto}
        </Button>
        {url && (
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={onRemove}
          >
            {words.remove}
          </Button>
        )}
      </div>
      {field}
    </div>
  )
}
