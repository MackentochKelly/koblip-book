import {
  CalendarDaysIcon,
  ClockIcon,
  CreditCardIcon,
  HandHeartIcon,
  ImageIcon,
  InfoIcon,
  type Icon,
  type IconProps,
} from "@/components/ui/icons"
import type { PolicyPointIcon as PolicyPointIconName } from "@/lib/policy-rules"

// The picture for each key policy point (lib/policy-rules): the same in
// Settings, where the owner picks it, and in the booking flow.
export const POLICY_POINT_ICON: Record<PolicyPointIconName, Icon> = {
  calendar: CalendarDaysIcon,
  card: CreditCardIcon,
  clock: ClockIcon,
  image: ImageIcon,
  care: HandHeartIcon,
  info: InfoIcon,
}

export function PolicyPointIcon({
  icon,
  ...props
}: IconProps & { icon: PolicyPointIconName }) {
  const Picture = POLICY_POINT_ICON[icon]
  return <Picture {...props} />
}
