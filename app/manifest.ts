import type { MetadataRoute } from "next"
import {
  APP_ICON_SIZES,
  APP_NAME,
  APP_SHORT_NAME,
  APP_START_URL,
} from "@/lib/app-install"

// Makes Koblip Book installable: on the Home Screen with its own icon, and
// full screen like an app (nextjs.org/docs/app/guides/progressive-web-apps).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_SHORT_NAME,
    start_url: APP_START_URL,
    scope: "/",
    display: "standalone",
    background_color: "white",
    theme_color: "white",
    icons: APP_ICON_SIZES.map((size) => ({
      src: `/app-icon/${size}`,
      sizes: `${size}x${size}`,
      type: "image/png",
      purpose: "any",
    })),
  }
}
