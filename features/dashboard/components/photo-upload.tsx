"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ImageIcon } from "lucide-react"
import { toast } from "sonner"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { resizeImage } from "@/lib/resize-image"
import { UPLOAD_RULES } from "@/lib/upload-rules"
import type { PhotoError, PhotoResult } from "../media-types"

const ACCEPT = Object.keys(UPLOAD_RULES.types).join(",")

const ERRORS: Record<PhotoError, string> = {
  not_found: "That did not work. Please try again.",
  missing: "Pick a photo.",
  too_big: "That photo is too big.",
  wrong_type: "Use a JPEG, PNG or WebP photo.",
  limit: `Up to ${UPLOAD_RULES.maxBusinessPhotos} photos.`,
}

// Picks a photo, makes it smaller in the browser and sends it as the
// "file" field. `pick()` opens the phone's photo library or camera.
export function usePhotoUpload<T extends object>(
  upload: (formData: FormData) => Promise<PhotoResult<T>>,
  onDone?: (result: T) => void
) {
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
        toast.error(ERRORS[result.error])
      }
    })

  const field = (
    <input
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
// Change, and Remove.
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
  const router = useRouter()
  const [url, setUrl] = useState(photoUrl)
  const [removing, startRemoving] = useTransition()
  const { pick, pending, field } = usePhotoUpload(upload, (result) =>
    setUrl(result.photoUrl)
  )
  const busy = pending || removing

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
          onClick={pick}
        >
          {pending && <Spinner data-icon="inline-start" />}
          {url ? "Change" : "Add photo"}
        </Button>
        {url && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() =>
              startRemoving(async () => {
                const result = await remove().catch(
                  () => ({ ok: false, error: "not_found" }) as const
                )
                if (result.ok) {
                  setUrl(null)
                  router.refresh()
                } else {
                  toast.error(ERRORS[result.error])
                }
              })
            }
          >
            Remove
          </Button>
        )}
      </div>
      {field}
    </div>
  )
}
