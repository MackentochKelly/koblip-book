import { notFound } from "next/navigation"
import { appIcon } from "@/lib/app-icon"
import { APP_ICON_SIZES } from "@/lib/app-install"

// The install icons app/manifest.ts lists (/app-icon/192, /app-icon/512),
// made once at build time.
export const dynamicParams = false

export function generateStaticParams() {
  return APP_ICON_SIZES.map((size) => ({ size: String(size) }))
}

export async function GET(
  _request: Request,
  { params }: RouteContext<"/app-icon/[size]">
) {
  const size = Number((await params).size)
  if (!APP_ICON_SIZES.includes(size as (typeof APP_ICON_SIZES)[number])) {
    notFound()
  }
  return appIcon(size)
}
