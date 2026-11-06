"use client"

import { useTransition } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ImageIcon,
  PlusIcon,
  Trash2Icon,
} from "@/components/ui/icons"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { MoreMenuTrigger } from "@/components/more-menu-trigger"
import { PageSection } from "@/components/page-section"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Spinner } from "@/components/ui/spinner"
import { UPLOAD_RULES } from "@/lib/upload-rules"
import {
  deleteBusinessPhoto,
  reorderBusinessPhotos,
  uploadBusinessPhoto,
} from "../api/photo-actions"
import type { OwnerPhoto } from "../media-types"
import { usePhotoUpload } from "@/components/photo-upload"

// The page's own photos, shown before Google's. The first one leads.
export function BusinessPhotosEditor({
  businessId,
  photos,
}: {
  businessId: string
  photos: OwnerPhoto[]
}) {
  const settings = useTranslations("owner.settings")
  const t = useTranslations("owner.settings.photos")
  const router = useRouter()
  const [busy, startTransition] = useTransition()
  const { pick, pending, field } = usePhotoUpload((formData) =>
    uploadBusinessPhoto(businessId, formData)
  )
  const full = photos.length >= UPLOAD_RULES.maxBusinessPhotos

  const run = (task: () => Promise<{ ok: boolean }>) =>
    startTransition(async () => {
      const result = await task().catch(() => ({ ok: false }))
      if (result.ok) router.refresh()
      else toast.error(settings("tryAgain"))
    })
  const move = (index: number, by: number) => {
    const ids = photos.map((photo) => photo.id)
    const [id] = ids.splice(index, 1)
    ids.splice(index + by, 0, id)
    run(() => reorderBusinessPhotos(businessId, ids))
  }

  return (
    <PageSection
      id="photos"
      title={t("title")}
      action={
        <Button variant="outline" onClick={pick} disabled={pending || full}>
          {pending ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <PlusIcon data-icon="inline-start" />
          )}
          {t("add")}
        </Button>
      }
    >
      {field}
      {photos.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ImageIcon />
            </EmptyMedia>
            <EmptyTitle>{t("none")}</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {photos.map((photo, index) => (
            <li
              key={photo.id}
              className="relative aspect-4/3 overflow-hidden rounded-lg bg-muted"
            >
              <Image
                src={photo.url}
                alt={t("photo", { n: index + 1 })}
                fill
                unoptimized
                sizes="(max-width: 640px) 50vw, 33vw"
                className="object-cover"
              />
              <DropdownMenu>
                <MoreMenuTrigger label={t("options", { n: index + 1 })} className="absolute top-2 right-2" />
                <DropdownMenuContent align="end">
                  <DropdownMenuGroup>
                    <DropdownMenuItem
                      disabled={index === 0 || busy}
                      onClick={() => move(index, -1)}
                    >
                      <ArrowLeftIcon />
                      {t("moveLeft")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={index === photos.length - 1 || busy}
                      onClick={() => move(index, 1)}
                    >
                      <ArrowRightIcon />
                      {t("moveRight")}
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem
                      variant="destructive"
                      disabled={busy}
                      onClick={() =>
                        run(() => deleteBusinessPhoto(businessId, photo.id))
                      }
                    >
                      <Trash2Icon />
                      {t("remove")}
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          ))}
        </ul>
      )}
    </PageSection>
  )
}
