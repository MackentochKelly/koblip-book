import { appIcon } from "@/lib/app-icon"

// The icon an iPhone shows when the page is added to its Home Screen
// (nextjs.org/docs/app/api-reference/file-conventions/metadata/app-icons):
// the Koblip logo on white, 180 × 180, made once at build time.
export const size = { width: 180, height: 180 }
export const contentType = "image/png"

export default function AppleIcon() {
  return appIcon(size.width)
}
