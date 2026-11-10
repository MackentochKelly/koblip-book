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
  Bank as MynaBank,
  Bell as MynaBell,
  Calendar as MynaCalendar,
  ChartColumnIncreasing as MynaChartColumnIncreasing,
  ChartColumnIncreasingSolid as MynaChartColumnIncreasingSolid,
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
  Copy as MynaCopy,
  Cog as MynaCog,
  CornerLeftUp as MynaCornerLeftUp,
  CreditCard as MynaCreditCard,
  DangerCircle as MynaDangerCircle,
  DangerTriangle as MynaDangerTriangle,
  DotsVertical as MynaDotsVertical,
  Edit as MynaEdit,
  ExternalLink as MynaExternalLink,
  Filter as MynaFilter,
  Globe as MynaGlobe,
  Grid as MynaGrid,
  GripVertical as MynaGripVertical,
  Home as MynaHome,
  Image as MynaImage,
  Info as MynaInfo,
  InfoCircle as MynaInfoCircle,
  Link as MynaLink,
  Logout as MynaLogout,
  Mail as MynaMail,
  MapPin as MynaMapPin,
  Maximize as MynaMaximize,
  Minus as MynaMinus,
  Minimize as MynaMinimize,
  Monitor as MynaMonitor,
  Moon as MynaMoon,
  Navigation as MynaNavigation,
  Plus as MynaPlus,
  Puzzle as MynaPuzzle,
  Refresh as MynaRefresh,
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
  UserSolid as MynaUserSolid,
  Clock3Solid as MynaClock3Solid,
  HomeSolid as MynaHomeSolid,
  StoreSolid as MynaStoreSolid,
  ChatSolid as MynaChatSolid,
  PuzzleSolid as MynaPuzzleSolid,
  SparklesSolid as MynaSparklesSolid,
  LayoutDashboard as MynaLayoutDashboard,
  LayoutDashboardSolid as MynaLayoutDashboardSolid,
  Flower as MynaFlower,
  GraduationCap as MynaGraduationCap,
  Smile as MynaSmile,
  Wrench as MynaWrench,
  Zap as MynaZap,
  ZapSolid as MynaZapSolid,
  CheckCircleSolid as MynaCheckCircleSolid,
  TrendingUp as MynaTrendingUp,
  User as MynaUser,
  UserX as MynaUserX,
  UserPlus as MynaUserPlus,
  Download as MynaDownload,
  PlusSquare as MynaPlusSquare,
  Bookmark as MynaBookmark,
  Glasses as MynaGlasses,
  Pause as MynaPause,
  Play as MynaPlay,
} from "@mynaui/icons-react"
import {
  AudioLines as LucideAudioLines,
  BadgeCheck as LucideBadgeCheck,
  Banknote as LucideBanknote,
  CarFront as LucideCarFront,
  Ellipsis as LucideEllipsis,
  Compass as LucideCompass,
  Dumbbell as LucideDumbbell,
  HandHeart as LucideHandHeart,
  Languages as LucideLanguages,
  LoaderCircle as LucideLoaderCircle,
  LocateFixed as LucideLocateFixed,
  Nfc as LucideNfc,
  OctagonX as LucideOctagonX,
  Palette as LucidePalette,
  PawPrint as LucidePawPrint,
  Share as LucideShare,
  Stethoscope as LucideStethoscope,
  Toilet as LucideToilet,
} from "lucide-react"

import { cn } from "@/lib/utils"

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

function icon(
  Source: ComponentType<IconProps>,
  name: string,
  baseClassName?: string
): Icon {
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
        className={cn(baseClassName, props.className)}
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
export const AudioLinesIcon = icon(LucideAudioLines as Icon, "AudioLinesIcon")
export const BadgeCheckIcon = icon(LucideBadgeCheck as Icon, "BadgeCheckIcon")
export const BankIcon = icon(MynaBank as Icon, "BankIcon")
export const BanknoteIcon = icon(LucideBanknote as Icon, "BanknoteIcon")
export const BellIcon = icon(MynaBell as Icon, "BellIcon")
export const CalendarDaysIcon = icon(MynaCalendar as Icon, "CalendarDaysIcon")
export const CalendarIcon = icon(MynaCalendar as Icon, "CalendarIcon")
export const FilterIcon = icon(MynaFilter as Icon, "FilterIcon")
export const CalendarX2Icon = icon(MynaCalendarX as Icon, "CalendarX2Icon")
export const CarFrontIcon = icon(LucideCarFront as Icon, "CarFrontIcon")
export const CheckIcon = icon(MynaCheck as Icon, "CheckIcon")
export const BookmarkIcon = icon(MynaBookmark as Icon, "BookmarkIcon")
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
// Filled, for a "done" mark that stays sharp at small sizes.
export const CircleCheckFilledIcon = icon(
  MynaCheckCircleSolid as Icon,
  "CircleCheckFilledIcon"
)
export const ClockIcon = icon(MynaClock3 as Icon, "ClockIcon")
export const ContactIcon = icon(MynaUserSquare as Icon, "ContactIcon")
export const CopyIcon = icon(MynaCopy as Icon, "CopyIcon")
export const CornerLeftUpIcon = icon(
  MynaCornerLeftUp as Icon,
  "CornerLeftUpIcon"
)
export const CreditCardIcon = icon(MynaCreditCard as Icon, "CreditCardIcon")
export const EllipsisIcon = icon(LucideEllipsis as Icon, "EllipsisIcon")
// Lucide's MoreHorizontal is now named Ellipsis; shadcn's Pagination asks
// for it by the old name.
export const MoreHorizontalIcon = icon(
  LucideEllipsis as Icon,
  "MoreHorizontalIcon"
)
export const EllipsisVerticalIcon = icon(
  MynaDotsVertical as Icon,
  "EllipsisVerticalIcon"
)
export const DownloadIcon = icon(MynaDownload as Icon, "DownloadIcon")
export const DumbbellIcon = icon(LucideDumbbell as Icon, "DumbbellIcon")
export const ExternalLinkIcon = icon(
  MynaExternalLink as Icon,
  "ExternalLinkIcon"
)
export const ChartColumnIcon = icon(
  MynaChartColumnIncreasing as Icon,
  "ChartColumnIcon"
)
export const FlowerIcon = icon(MynaFlower as Icon, "FlowerIcon")
export const GlobeIcon = icon(MynaGlobe as Icon, "GlobeIcon")
export const GraduationCapIcon = icon(
  MynaGraduationCap as Icon,
  "GraduationCapIcon"
)
export const HandHeartIcon = icon(LucideHandHeart as Icon, "HandHeartIcon")
export const GripVerticalIcon = icon(
  MynaGripVertical as Icon,
  "GripVerticalIcon"
)
export const HouseIcon = icon(MynaHome as Icon, "HouseIcon")
export const ImageIcon = icon(MynaImage as Icon, "ImageIcon")
export const InfoIcon = icon(MynaInfo as Icon, "InfoIcon")
export const InfoCircleIcon = icon(MynaInfoCircle as Icon, "InfoCircleIcon")
export const LanguagesIcon = icon(LucideLanguages as Icon, "LanguagesIcon")
export const LayoutGridIcon = icon(MynaGrid as Icon, "LayoutGridIcon")
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
export const MaximizeIcon = icon(MynaMaximize as Icon, "MaximizeIcon")
export const MinusIcon = icon(MynaMinus as Icon, "MinusIcon")
export const MessageCircleIcon = icon(MynaChat as Icon, "MessageCircleIcon")
export const MinimizeIcon = icon(MynaMinimize as Icon, "MinimizeIcon")
export const MonitorIcon = icon(MynaMonitor as Icon, "MonitorIcon")
export const MoonIcon = icon(MynaMoon as Icon, "MoonIcon")
export const NavigationIcon = icon(MynaNavigation as Icon, "NavigationIcon")
export const NfcIcon = icon(LucideNfc as Icon, "NfcIcon")
export const OctagonXIcon = icon(LucideOctagonX as Icon, "OctagonXIcon")
export const PaletteIcon = icon(LucidePalette as Icon, "PaletteIcon")
export const PanelLeftIcon = icon(MynaSidebar as Icon, "PanelLeftIcon")
export const PauseIcon = icon(MynaPause as Icon, "PauseIcon")
export const PawPrintIcon = icon(LucidePawPrint as Icon, "PawPrintIcon")
export const PhoneCallIcon = icon(MynaTelephoneCall as Icon, "PhoneCallIcon")
export const PhoneIcon = icon(MynaTelephone as Icon, "PhoneIcon")
export const PlayIcon = icon(MynaPlay as Icon, "PlayIcon")
export const PlusSquareIcon = icon(MynaPlusSquare as Icon, "PlusSquareIcon")
export const PlusIcon = icon(MynaPlus as Icon, "PlusIcon")
export const PuzzleIcon = icon(MynaPuzzle as Icon, "PuzzleIcon")
export const GlassesIcon = icon(MynaGlasses as Icon, "GlassesIcon")
export const RefreshIcon = icon(MynaRefresh as Icon, "RefreshIcon")
export const TagIcon = icon(MynaTag as Icon, "TagIcon")
export const SearchIcon = icon(MynaSearch as Icon, "SearchIcon")
export const SearchXIcon = icon(MynaSearchX as Icon, "SearchXIcon")
export const SettingsIcon = icon(MynaCog as Icon, "SettingsIcon")
export const ShareIcon = icon(MynaShare as Icon, "ShareIcon")
// The iPhone's Share button (a box with an arrow up), for "tap Share" steps.
export const ShareUpIcon = icon(LucideShare as Icon, "ShareUpIcon")
export const ShieldCheckIcon = icon(MynaShieldCheck as Icon, "ShieldCheckIcon")
export const SparklesIcon = icon(MynaSparkles as Icon, "SparklesIcon")
export const SmileIcon = icon(MynaSmile as Icon, "SmileIcon")
export const SquareIcon = icon(MynaSquare as Icon, "SquareIcon")
export const SquarePenIcon = icon(MynaEdit as Icon, "SquarePenIcon")
export const StarIcon = icon(MynaStar as Icon, "StarIcon")
export const StethoscopeIcon = icon(
  LucideStethoscope as Icon,
  "StethoscopeIcon"
)
export const StoreIcon = icon(MynaStore as Icon, "StoreIcon")
export const SunIcon = icon(MynaSun as Icon, "SunIcon")
export const ToiletIcon = icon(LucideToilet as Icon, "ToiletIcon")
export const Trash2Icon = icon(MynaTrash as Icon, "Trash2Icon")
export const TriangleAlertIcon = icon(
  MynaDangerTriangle as Icon,
  "TriangleAlertIcon"
)
export const TrendingUpIcon = icon(MynaTrendingUp as Icon, "TrendingUpIcon")
export const UserPlusIcon = icon(MynaUserPlus as Icon, "UserPlusIcon")
export const UserIcon = icon(MynaUser as Icon, "UserIcon")
export const UserXIcon = icon(MynaUserX as Icon, "UserXIcon")
export const UsersIcon = icon(MynaUsers as Icon, "UsersIcon")
export const WrenchIcon = icon(MynaWrench as Icon, "WrenchIcon")
// A business's website, everywhere it shows (mynaui has no compass).
export const WebsiteIcon = icon(LucideCompass as Icon, "WebsiteIcon")
export const XIcon = icon(MynaX as Icon, "XIcon")
export const ZapIcon = icon(MynaZap as Icon, "ZapIcon")

// A brand's own logo. Neither icon set has brand logos, so each glyph is
// drawn here (Simple Icons, CC0), filled in the text colour like the other
// icons, so it follows the theme in light and dark.
const brand = (name: string, glyph: string): Icon => {
  const Brand: Icon = forwardRef<SVGSVGElement, IconProps>(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    function Brand({ size = 24, strokeWidth, children, ...props }, ref) {
      const named =
        props["aria-label"] != null ||
        props["aria-labelledby"] != null ||
        props.role === "img"
      return (
        <svg
          ref={ref}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          width={size}
          height={size}
          fill="currentColor"
          aria-hidden={named ? undefined : true}
          {...props}
        >
          <path d={glyph} />
          {children}
        </svg>
      )
    }
  )
  Brand.displayName = name
  return Brand
}

// WhatsApp's logo, wherever something stands for WhatsApp.
export const WhatsAppIcon = brand(
  "WhatsAppIcon",
  "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"
)
// Zelle's and Cash App's logos, for a business paid that way
// (components/payment-type-icon.tsx).
export const ZelleIcon = brand(
  "ZelleIcon",
  "M13.559 24h-2.841a.483.483 0 0 1-.483-.483v-2.765H5.638a.667.667 0 0 1-.666-.666v-2.234a.67.67 0 0 1 .142-.412l8.139-10.382h-7.25a.667.667 0 0 1-.667-.667V3.914c0-.367.299-.666.666-.666h4.23V.483c0-.266.217-.483.483-.483h2.841c.266 0 .483.217.483.483v2.765h4.323c.367 0 .666.299.666.666v2.137a.67.67 0 0 1-.141.41l-8.19 10.481h7.665c.367 0 .666.299.666.666v2.477a.667.667 0 0 1-.666.667h-4.32v2.765a.483.483 0 0 1-.483.483Z"
)
export const CashAppIcon = brand(
  "CashAppIcon",
  "M23.59 3.475a5.1 5.1 0 00-3.05-3.05c-1.31-.42-2.5-.42-4.92-.42H8.36c-2.4 0-3.61 0-4.9.4a5.1 5.1 0 00-3.05 3.06C0 4.765 0 5.965 0 8.365v7.27c0 2.41 0 3.6.4 4.9a5.1 5.1 0 003.05 3.05c1.3.41 2.5.41 4.9.41h7.28c2.41 0 3.61 0 4.9-.4a5.1 5.1 0 003.06-3.06c.41-1.3.41-2.5.41-4.9v-7.25c0-2.41 0-3.61-.41-4.91zm-6.17 4.63l-.93.93a.5.5 0 01-.67.01 5 5 0 00-3.22-1.18c-.97 0-1.94.32-1.94 1.21 0 .9 1.04 1.2 2.24 1.65 2.1.7 3.84 1.58 3.84 3.64 0 2.24-1.74 3.78-4.58 3.95l-.26 1.2a.49.49 0 01-.48.39H9.63l-.09-.01a.5.5 0 01-.38-.59l.28-1.27a6.54 6.54 0 01-2.88-1.57v-.01a.48.48 0 010-.68l1-.97a.49.49 0 01.67 0c.91.86 2.13 1.34 3.39 1.32 1.3 0 2.17-.55 2.17-1.42 0-.87-.88-1.1-2.54-1.72-1.76-.63-3.43-1.52-3.43-3.6 0-2.42 2.01-3.6 4.39-3.71l.25-1.23a.48.48 0 01.48-.38h1.78l.1.01c.26.06.43.31.37.57l-.27 1.37c.9.3 1.75.77 2.48 1.39l.02.02c.19.2.19.5 0 .68z"
)

// Filled twins of outline icons: the open page's icon shows filled, in the
// phone tab bar and the sidebar alike, as iPhone and Android apps do. An
// icon without a twin stays as it is.
// Its colour: the text colour softened to a dark grey (not pure black), so
// the solid shape sits with its label instead of standing out.
const filled = (Source: ComponentType<IconProps>, name: string) =>
  icon(Source, name, "text-foreground/80")

const FILLED = new Map<Icon, Icon>([
  [
    LayoutDashboardIcon,
    filled(MynaLayoutDashboardSolid as Icon, "LayoutDashboardFilledIcon"),
  ],
  [
    ChartColumnIcon,
    filled(MynaChartColumnIncreasingSolid as Icon, "ChartColumnFilledIcon"),
  ],
  [CalendarDaysIcon, filled(MynaCalendarSolid as Icon, "CalendarDaysFilledIcon")],
  [CalendarIcon, filled(MynaCalendarSolid as Icon, "CalendarFilledIcon")],
  [ContactIcon, filled(MynaUserSquareSolid as Icon, "ContactFilledIcon")],
  [TagIcon, filled(MynaTagSolid as Icon, "TagFilledIcon")],
  [SettingsIcon, filled(MynaCogSolid as Icon, "SettingsFilledIcon")],
  [UsersIcon, filled(MynaUsersSolid as Icon, "UsersFilledIcon")],
  [UserIcon, filled(MynaUserSolid as Icon, "UserFilledIcon")],
  [ClockIcon, filled(MynaClock3Solid as Icon, "ClockFilledIcon")],
  [HouseIcon, filled(MynaHomeSolid as Icon, "HouseFilledIcon")],
  [StoreIcon, filled(MynaStoreSolid as Icon, "StoreFilledIcon")],
  [MessageCircleIcon, filled(MynaChatSolid as Icon, "MessageCircleFilledIcon")],
  [PuzzleIcon, filled(MynaPuzzleSolid as Icon, "PuzzleFilledIcon")],
  [SparklesIcon, filled(MynaSparklesSolid as Icon, "SparklesFilledIcon")],
  [ZapIcon, filled(MynaZapSolid as Icon, "ZapFilledIcon")],
])

export function filledIcon(outline: Icon): Icon {
  return FILLED.get(outline) ?? outline
}
