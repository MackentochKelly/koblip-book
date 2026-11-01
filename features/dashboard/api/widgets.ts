import "server-only"

import { cookies } from "next/headers"
import type { WidgetLayout } from "../widgets"
import { WIDGETS_COOKIE_PREFIX } from "../widgets"
import { normalizeLayout } from "../utils/widget-layout"

// Home's layout for this business on this device: the device's own when
// the owner chose "This device only", else the one saved on the account.
export async function getWidgetLayout(business: {
  id: string
  dashboardWidgets: unknown
}): Promise<{ layout: WidgetLayout; device: boolean }> {
  const own = (await cookies()).get(WIDGETS_COOKIE_PREFIX + business.id)
  if (own) {
    try {
      return { layout: normalizeLayout(JSON.parse(own.value)), device: true }
    } catch {}
  }
  return { layout: normalizeLayout(business.dashboardWidgets), device: false }
}
