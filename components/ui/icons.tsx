import {
  Children,
  forwardRef,
  type ComponentProps,
  type ComponentType,
} from "react"
import {
  Accessibility as MynaAccessibility,
  ArrowDown as MynaArrowDown,
  ArrowLeft as MynaArrowLeft,
  ArrowRight as MynaArrowRight,
  ArrowUp as MynaArrowUp,
  Baby as MynaBaby,
  Calendar as MynaCalendar,
  CalendarX as MynaCalendarX,
  Chat as MynaChat,
  Check as MynaCheck,
  CheckCircle as MynaCheckCircle,
  ChevronDown as MynaChevronDown,
  ChevronLeft as MynaChevronLeft,
  ChevronRight as MynaChevronRight,
  ChevronUp as MynaChevronUp,
  ChevronsUpDown as MynaChevronsUpDown,
  Clock3 as MynaClock3,
  Cog as MynaCog,
  CornerLeftUp as MynaCornerLeftUp,
  CreditCard as MynaCreditCard,
  DangerCircle as MynaDangerCircle,
  DangerTriangle as MynaDangerTriangle,
  DotsVertical as MynaDotsVertical,
  Edit as MynaEdit,
  ExternalLink as MynaExternalLink,
  Globe as MynaGlobe,
  Home as MynaHome,
  Image as MynaImage,
  Info as MynaInfo,
  Link as MynaLink,
  Logout as MynaLogout,
  Mail as MynaMail,
  MapPin as MynaMapPin,
  Microphone as MynaMicrophone,
  Monitor as MynaMonitor,
  Moon as MynaMoon,
  Navigation as MynaNavigation,
  Plus as MynaPlus,
  Tag as MynaTag,
  Search as MynaSearch,
  SearchX as MynaSearchX,
  Share as MynaShare,
  ShieldCheck as MynaShieldCheck,
  Sidebar as MynaSidebar,
  Sparkles as MynaSparkles,
  Square as MynaSquare,
  Star as MynaStar,
  Store as MynaStore,
  Sun as MynaSun,
  Telephone as MynaTelephone,
  TelephoneCall as MynaTelephoneCall,
  Trash as MynaTrash,
  UserSquare as MynaUserSquare,
  Users as MynaUsers,
  X as MynaX,
  CalendarSolid as MynaCalendarSolid,
  UserSquareSolid as MynaUserSquareSolid,
  TagSolid as MynaTagSolid,
  CogSolid as MynaCogSolid,
  UsersSolid as MynaUsersSolid,
  Clock3Solid as MynaClock3Solid,
  HomeSolid as MynaHomeSolid,
  StoreSolid as MynaStoreSolid,
  ChatSolid as MynaChatSolid,
  LayoutDashboard as MynaLayoutDashboard,
  LayoutDashboardSolid as MynaLayoutDashboardSolid,
} from "@mynaui/icons-react"
import {
  AppWindow as LucideAppWindow,
  BadgeCheck as LucideBadgeCheck,
  Banknote as LucideBanknote,
  CarFront as LucideCarFront,
  Languages as LucideLanguages,
  LoaderCircle as LucideLoaderCircle,
  LocateFixed as LucideLocateFixed,
  Nfc as LucideNfc,
  OctagonX as LucideOctagonX,
  PawPrint as LucidePawPrint,
  Toilet as LucideToilet,
} from "lucide-react"

// The app's one icon set, as in Koblip Sales: every icon on screen comes
// from this file, so the look is decided once. mynaui's thin, rounded
// outlines, with a Lucide icon at the same line weight wherever mynaui has no
// match. Import icons from here only (lint blocks importing an icon package
// anywhere else); to change an icon across the app, change its line below.
// Names follow Lucide's, the vocabulary shadcn uses.

// One line weight for every icon in the app.
export const ICON_STROKE_WIDTH = 1.5

export type IconProps = ComponentProps<"svg"> & {
  size?: number | string
  strokeWidth?: number | string
}

// Any icon from this file; use it where a prop or a config takes an icon.
export type Icon = ComponentType<IconProps>

function icon(Source: ComponentType<IconProps>, name: string): Icon {
  // Decorative unless it is given a name of its own, as Lucide does.
  const Component = forwardRef<SVGSVGElement, IconProps>((props, ref) => {
    const named =
      props["aria-label"] != null ||
      props["aria-labelledby"] != null ||
      props.role === "img"
    // mynaui spreads children and crashes on a single child, so they are
    // always an array.
    return (
      <Source
        ref={ref}
        strokeWidth={ICON_STROKE_WIDTH}
        aria-hidden={named ? undefined : true}
        {...props}
      >
        {Children.toArray(props.children)}
      </Source>
    )
  })
  Component.displayName = name
  return Component
}

export const AccessibilityIcon = icon(
  MynaAccessibility as Icon,
  "AccessibilityIcon"
)
export const AlertCircleIcon = icon(MynaDangerCircle as Icon, "AlertCircleIcon")
export const ArrowDownIcon = icon(MynaArrowDown as Icon, "ArrowDownIcon")
export const ArrowLeftIcon = icon(MynaArrowLeft as Icon, "ArrowLeftIcon")
export const ArrowRightIcon = icon(MynaArrowRight as Icon, "ArrowRightIcon")
export const ArrowUpIcon = icon(MynaArrowUp as Icon, "ArrowUpIcon")
export const BabyIcon = icon(MynaBaby as Icon, "BabyIcon")
export const BadgeCheckIcon = icon(LucideBadgeCheck as Icon, "BadgeCheckIcon")
export const BanknoteIcon = icon(LucideBanknote as Icon, "BanknoteIcon")
export const CalendarDaysIcon = icon(MynaCalendar as Icon, "CalendarDaysIcon")
export const CalendarIcon = icon(MynaCalendar as Icon, "CalendarIcon")
export const CalendarX2Icon = icon(MynaCalendarX as Icon, "CalendarX2Icon")
export const CarFrontIcon = icon(LucideCarFront as Icon, "CarFrontIcon")
export const CheckIcon = icon(MynaCheck as Icon, "CheckIcon")
export const ChevronDownIcon = icon(MynaChevronDown as Icon, "ChevronDownIcon")
export const ChevronLeftIcon = icon(MynaChevronLeft as Icon, "ChevronLeftIcon")
export const ChevronRightIcon = icon(
  MynaChevronRight as Icon,
  "ChevronRightIcon"
)
export const ChevronUpIcon = icon(MynaChevronUp as Icon, "ChevronUpIcon")
export const ChevronsUpDownIcon = icon(
  MynaChevronsUpDown as Icon,
  "ChevronsUpDownIcon"
)
export const CircleAlertIcon = icon(MynaDangerCircle as Icon, "CircleAlertIcon")
export const CircleCheckIcon = icon(MynaCheckCircle as Icon, "CircleCheckIcon")
export const ClockIcon = icon(MynaClock3 as Icon, "ClockIcon")
export const ContactIcon = icon(MynaUserSquare as Icon, "ContactIcon")
export const CornerLeftUpIcon = icon(
  MynaCornerLeftUp as Icon,
  "CornerLeftUpIcon"
)
export const CreditCardIcon = icon(MynaCreditCard as Icon, "CreditCardIcon")
export const EllipsisVerticalIcon = icon(
  MynaDotsVertical as Icon,
  "EllipsisVerticalIcon"
)
export const ExternalLinkIcon = icon(
  MynaExternalLink as Icon,
  "ExternalLinkIcon"
)
export const GlobeIcon = icon(MynaGlobe as Icon, "GlobeIcon")
export const HouseIcon = icon(MynaHome as Icon, "HouseIcon")
export const ImageIcon = icon(MynaImage as Icon, "ImageIcon")
export const InfoIcon = icon(MynaInfo as Icon, "InfoIcon")
export const LanguagesIcon = icon(LucideLanguages as Icon, "LanguagesIcon")
export const LayoutDashboardIcon = icon(
  MynaLayoutDashboard as Icon,
  "LayoutDashboardIcon"
)
export const LinkIcon = icon(MynaLink as Icon, "LinkIcon")
export const Loader2Icon = icon(LucideLoaderCircle as Icon, "Loader2Icon")
export const LocateFixedIcon = icon(
  LucideLocateFixed as Icon,
  "LocateFixedIcon"
)
export const LogOutIcon = icon(MynaLogout as Icon, "LogOutIcon")
export const MailIcon = icon(MynaMail as Icon, "MailIcon")
export const MapPinIcon = icon(MynaMapPin as Icon, "MapPinIcon")
export const MessageCircleIcon = icon(MynaChat as Icon, "MessageCircleIcon")
export const MicIcon = icon(MynaMicrophone as Icon, "MicIcon")
export const MonitorIcon = icon(MynaMonitor as Icon, "MonitorIcon")
export const MoonIcon = icon(MynaMoon as Icon, "MoonIcon")
export const NavigationIcon = icon(MynaNavigation as Icon, "NavigationIcon")
export const NfcIcon = icon(LucideNfc as Icon, "NfcIcon")
export const OctagonXIcon = icon(LucideOctagonX as Icon, "OctagonXIcon")
export const PanelLeftIcon = icon(MynaSidebar as Icon, "PanelLeftIcon")
export const PawPrintIcon = icon(LucidePawPrint as Icon, "PawPrintIcon")
export const PhoneCallIcon = icon(MynaTelephoneCall as Icon, "PhoneCallIcon")
export const PhoneIcon = icon(MynaTelephone as Icon, "PhoneIcon")
export const PlusIcon = icon(MynaPlus as Icon, "PlusIcon")
export const TagIcon = icon(MynaTag as Icon, "TagIcon")
export const SearchIcon = icon(MynaSearch as Icon, "SearchIcon")
export const SearchXIcon = icon(MynaSearchX as Icon, "SearchXIcon")
export const SettingsIcon = icon(MynaCog as Icon, "SettingsIcon")
export const ShareIcon = icon(MynaShare as Icon, "ShareIcon")
export const ShieldCheckIcon = icon(MynaShieldCheck as Icon, "ShieldCheckIcon")
export const SparklesIcon = icon(MynaSparkles as Icon, "SparklesIcon")
export const SquareIcon = icon(MynaSquare as Icon, "SquareIcon")
export const SquarePenIcon = icon(MynaEdit as Icon, "SquarePenIcon")
export const StarIcon = icon(MynaStar as Icon, "StarIcon")
export const StoreIcon = icon(MynaStore as Icon, "StoreIcon")
export const SunIcon = icon(MynaSun as Icon, "SunIcon")
export const ToiletIcon = icon(LucideToilet as Icon, "ToiletIcon")
export const Trash2Icon = icon(MynaTrash as Icon, "Trash2Icon")
export const TriangleAlertIcon = icon(
  MynaDangerTriangle as Icon,
  "TriangleAlertIcon"
)
export const UsersIcon = icon(MynaUsers as Icon, "UsersIcon")
// A business's website, everywhere it shows (mynaui has no browser window).
export const WebsiteIcon = icon(LucideAppWindow as Icon, "WebsiteIcon")
export const XIcon = icon(MynaX as Icon, "XIcon")

// Filled twins of outline icons: the open tab of a phone tab bar shows its
// icon filled, as iPhone and Android apps do. An icon without a twin stays
// as it is.
const FILLED = new Map<Icon, Icon>([
  [
    LayoutDashboardIcon,
    icon(MynaLayoutDashboardSolid as Icon, "LayoutDashboardFilledIcon"),
  ],
  [CalendarDaysIcon, icon(MynaCalendarSolid as Icon, "CalendarDaysFilledIcon")],
  [CalendarIcon, icon(MynaCalendarSolid as Icon, "CalendarFilledIcon")],
  [ContactIcon, icon(MynaUserSquareSolid as Icon, "ContactFilledIcon")],
  [TagIcon, icon(MynaTagSolid as Icon, "TagFilledIcon")],
  [SettingsIcon, icon(MynaCogSolid as Icon, "SettingsFilledIcon")],
  [UsersIcon, icon(MynaUsersSolid as Icon, "UsersFilledIcon")],
  [ClockIcon, icon(MynaClock3Solid as Icon, "ClockFilledIcon")],
  [HouseIcon, icon(MynaHomeSolid as Icon, "HouseFilledIcon")],
  [StoreIcon, icon(MynaStoreSolid as Icon, "StoreFilledIcon")],
  [MessageCircleIcon, icon(MynaChatSolid as Icon, "MessageCircleFilledIcon")],
])

export function filledIcon(outline: Icon): Icon {
  return FILLED.get(outline) ?? outline
}
