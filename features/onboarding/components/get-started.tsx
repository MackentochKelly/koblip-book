"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { AnimatePresence, motion } from "motion/react"
import { useRouter } from "next/navigation"
import {
  ArrowLeftIcon,
  CornerLeftUpIcon,
  LinkIcon,
  MapPinIcon,
  NavigationIcon,
  SearchIcon,
  StoreIcon,
  XIcon,
} from "lucide-react"

import {
  glassClassName,
  glassEdgeClassName,
  glassFrameClassName,
} from "@/components/glass-frame"
import { ViewTabs, type ViewTab } from "@/components/view-tabs"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Field, FieldError } from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { Spinner } from "@/components/ui/spinner"
import { useIsMobile } from "@/hooks/use-mobile"
import { useVisualViewport } from "@/hooks/use-visual-viewport"
import { AuthForm } from "@/features/owner-auth/components/auth-form"
import { ONBOARDING_RULES } from "@/lib/onboarding-rules"
import { cn } from "@/lib/utils"
import {
  prepareBusiness,
  prepareBusinessFromLink,
} from "../api/prepare-actions"
import { searchBusinesses } from "../api/search-actions"
import type { BusinessSuggestion, PreparedBusiness } from "../types"
import { useDebounced } from "../utils/use-debounced"
import { useSessionToken } from "../utils/use-session-token"
import { SearchAreaPanel, type SearchArea } from "./search-area"
import { SuggestionList } from "./suggestion-list"
import { noAutofill } from "@/lib/no-autofill"

type ClaimResult =
  { ok: true; businessId: string } | { ok: false; error: string }

interface Picked {
  name: string
  address: string | null
  prepared: Promise<PreparedBusiness>
}

const ERRORS = {
  invalid: "Paste a Google Maps link",
  not_found: "That business was not found on Google Maps",
  failed: "That did not work. Please try again.",
} as const

type Mode = "search" | "link"

// On a phone the search box grows into a full screen search when tapped
// (Motion layout animation: motion.dev/docs/react-layout-animations).
const GROW = { type: "spring", bounce: 0, duration: 0.4 } as const
// The page colour fades in behind the full screen search faster than it
// grows, so it is in place before the keyboard opens and Safari moves the page.
const COVER = { duration: 0.2, ease: "easeOut" } as const
const MotionCard = motion.create(Card)

const MODES: ViewTab<Mode>[] = [
  { id: "search", label: "Search", icon: <SearchIcon /> },
  { id: "link", label: "Maps link", icon: <LinkIcon /> },
]

// The home page's one box: find your business (or paste its Maps link),
// tap it, log in. The page is built while the owner logs in, then the
// business becomes theirs and its dashboard opens.
export function GetStarted({
  signedIn,
  claim,
  resume = null,
  hint = true,
}: {
  signedIn: boolean
  claim: (slug: string) => Promise<ClaimResult>
  // Back from Google login: the page to make the owner's.
  resume?: string | null
  hint?: boolean
}) {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>("search")
  const [picked, setPicked] = useState<Picked | null>(null)
  const [prepared, setPrepared] = useState<PreparedBusiness | null>(null)
  const [error, setError] = useState("")
  const [finishing, setFinishing] = useState(false)
  const isMobile = useIsMobile()
  const [expanded, setExpanded] = useState(false)
  // The box's place and corners on the page, kept while it is full screen.
  const [rest, setRest] = useState({ height: 0, radius: 0 })
  const frameRef = useRef<HTMLDivElement>(null)
  // Where the page was scrolled when the search opened.
  const scrollRef = useRef(0)
  const open = expanded && isMobile && !picked && mode === "search"
  // While full screen: the part of the screen above the keyboard.
  const visible = useVisualViewport(open)
  // While full screen, the grow animation runs only when the search opens
  // or closes: the keyboard and Safari's bars move it after that, and each
  // move would otherwise replay the 0.4s grow and lag behind (Motion
  // measures on every render while this is undefined;
  // motion.dev/docs/react-layout-animations).
  const growOnce = open || undefined
  const [resuming, setResuming] = useState(Boolean(resume && signedIn))

  // Back from Google: make the page the owner's and open its dashboard.
  useEffect(() => {
    if (!resume || !signedIn) return
    let current = true
    void claim(resume)
      .catch(() => null)
      .then((claimed) => {
        if (!current) return
        if (claimed?.ok) {
          router.replace(`/dashboard/${claimed.businessId}?welcome=1`)
          return
        }
        setResuming(false)
        router.replace("/")
      })
    return () => {
      current = false
    }
  }, [resume, signedIn, claim, router])

  const expand = () => {
    const frame = frameRef.current
    if (!isMobile || !frame || expanded) return
    setRest({
      height: frame.offsetHeight,
      radius: parseFloat(getComputedStyle(frame).borderTopLeftRadius),
    })
    scrollRef.current = window.scrollY
    setExpanded(true)
  }

  const collapse = () => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
    setExpanded(false)
  }

  // The page behind the full screen search stays still. When it closes, the
  // page goes back to where it was: iPhone Safari scrolls the page down to
  // make room for the keyboard and leaves it there. It is put back once
  // now and once more when the keyboard has gone.
  useEffect(() => {
    if (!open) return
    const root = document.documentElement
    root.style.overflow = "hidden"
    return () => {
      root.style.overflow = ""
      const top = scrollRef.current
      const restore = () => window.scrollTo(0, top)
      restore()
      const viewport = window.visualViewport
      viewport?.addEventListener("resize", restore, { once: true })
      setTimeout(() => viewport?.removeEventListener("resize", restore), 1000)
    }
  }, [open])

  const choose = (next: Picked) => {
    setPicked(next)
    setPrepared(null)
    setError("")
    void next.prepared.then((result) => {
      setPrepared(result)
      if (!result.ok) setError(ERRORS[result.error])
    })
    if (signedIn) void finish(next)
  }

  // After login (or straight away when already logged in): wait for the
  // page, make it the owner's, open its dashboard.
  const finish = async (current: Picked | null = picked) => {
    if (!current) return
    setFinishing(true)
    const result = await current.prepared
    if (!result.ok) {
      setFinishing(false)
      return
    }
    const claimed = await claim(result.slug).catch(() => null)
    if (!claimed?.ok) {
      setError(ERRORS.failed)
      setFinishing(false)
      return
    }
    router.push(`/dashboard/${claimed.businessId}?welcome=1`)
  }

  const back = () => {
    setPicked(null)
    setPrepared(null)
    setError("")
  }

  // The home page's box sits on the gradient: a see-through switch above it.
  const box = (content: React.ReactNode) => (
    <div className="flex w-full max-w-xl flex-col items-center gap-6">
      {!picked && (
        <ViewTabs
          views={MODES}
          value={mode}
          onChange={setMode}
          ariaLabel="How to find your business"
          listClassName={cn(
            glassClassName,
            glassEdgeClassName,
            "h-11! border p-1 *:h-full"
          )}
        />
      )}
      {/* The shared glass frame around the card. While full screen,
          an empty space of its size keeps the page still. */}
      <div
        className="w-full"
        style={open ? { height: rest.height } : undefined}
      >
        {/* The page colour over the whole page, from the moment the search
            opens, so the page behind never shows where iPhone Safari draws
            it (under the clock, behind its see-through keyboard bar). */}
        <AnimatePresence>
          {open && (
            <motion.div
              aria-hidden
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={COVER}
              className="fixed inset-x-0 -inset-y-[100vmax] z-50 bg-background"
            />
          )}
        </AnimatePresence>
        <motion.div
          ref={frameRef}
          layout
          layoutDependency={growOnce}
          transition={GROW}
          style={
            open
              ? {
                  borderRadius: 0,
                  ...(visible && { top: visible.top, height: visible.height }),
                }
              : rest.radius
                ? { borderRadius: rest.radius }
                : undefined
          }
          className={cn(
            glassFrameClassName,
            open &&
              "fixed inset-x-0 top-0 z-50 h-dvh bg-background p-0 inset-ring-0"
          )}
        >
          <MotionCard
            layout
            layoutDependency={growOnce}
            transition={GROW}
            className={cn(
              "text-left shadow-none ring-0",
              open && "h-full rounded-none"
            )}
          >
            <CardContent className={cn(open && "flex min-h-0 flex-1 flex-col")}>
              <motion.div
                layout="position"
                layoutDependency={growOnce}
                transition={GROW}
                className={cn(open && "flex min-h-0 flex-1 flex-col")}
              >
                {content}
              </motion.div>
            </CardContent>
          </MotionCard>
        </motion.div>
      </div>
      {/* The home page's note; the dashboard hides it. */}
      {!picked && hint && (
        <p className="flex items-center gap-2 text-sm font-medium">
          <CornerLeftUpIcon className="size-4" />
          Free to try, no card needed
        </p>
      )}
    </div>
  )

  if (resuming) {
    return box(
      <Button size="lg" disabled className="w-full">
        <Spinner data-icon="inline-start" />
        Building your page…
      </Button>
    )
  }

  if (!picked) {
    return box(
      mode === "link" ? (
        <PasteLink onChoose={choose} />
      ) : (
        <FindBusiness
          onChoose={(next) => {
            setExpanded(false)
            choose(next)
          }}
          expanded={open}
          onExpand={expand}
          onCollapse={collapse}
        />
      )
    )
  }

  const ready = prepared?.ok ? prepared : null
  const blocked = Boolean(error)
  return box(
    <div className="flex flex-col gap-5">
      <Item variant="muted" size="sm">
        <ItemMedia variant={ready?.photoUrl ? "image" : "icon"}>
          {ready?.photoUrl ? (
            <Image
              src={ready.photoUrl}
              alt=""
              width={40}
              height={40}
              unoptimized
            />
          ) : prepared ? (
            <StoreIcon />
          ) : (
            <Spinner />
          )}
        </ItemMedia>
        <ItemContent>
          <ItemTitle>{picked.name}</ItemTitle>
          {picked.address && (
            <ItemDescription className="line-clamp-1">
              {picked.address}
            </ItemDescription>
          )}
        </ItemContent>
      </Item>
      {blocked ? (
        <Field data-invalid>
          <FieldError>{error}</FieldError>
          <Button variant="outline" size="lg" onClick={back}>
            <ArrowLeftIcon data-icon="inline-start" />
            Search again
          </Button>
        </Field>
      ) : signedIn ? (
        <Button size="lg" disabled>
          <Spinner data-icon="inline-start" />
          Building your page…
        </Button>
      ) : (
        <>
          <AuthForm
            onSignedIn={() => finish()}
            disabled={finishing}
            googleNext={ready ? `/?claim=${ready.slug}` : undefined}
            googleReady={Boolean(ready)}
          />
          <Button variant="ghost" onClick={back} disabled={finishing}>
            Not your business?
          </Button>
        </>
      )}
    </div>
  )
}

// Search as you type, near the owner or a city they pick.
function FindBusiness({
  onChoose,
  expanded,
  onExpand,
  onCollapse,
}: {
  onChoose: (picked: Picked) => void
  expanded: boolean
  onExpand: () => void
  onCollapse: () => void
}) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<BusinessSuggestion[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [area, setArea] = useState<SearchArea | null>(null)
  const [areaOpen, setAreaOpen] = useState(false)
  const [locating, setLocating] = useState(false)
  const asked = useRef(false)
  const { current: sessionToken, renew } = useSessionToken()
  const needle = useDebounced(query.trim(), ONBOARDING_RULES.debounceMs)

  const locate = (quiet = false) => {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false)
        setAreaOpen(false)
        setArea({
          label: "Near me",
          center: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          },
        })
      },
      () => {
        setLocating(false)
        if (!quiet) setAreaOpen(true)
      },
      { maximumAge: 600_000, timeout: 10_000 }
    )
  }

  // The phone asks once, the first time the owner starts typing.
  const askLocation = () => {
    if (asked.current || area) return
    asked.current = true
    locate(true)
  }

  useEffect(() => {
    let current = true
    if (needle.length < ONBOARDING_RULES.minInput) {
      queueMicrotask(() => {
        if (!current) return
        setResults(null)
        setSearching(false)
      })
      return () => {
        current = false
      }
    }
    queueMicrotask(() => current && setSearching(true))
    void searchBusinesses({
      input: needle,
      sessionToken: sessionToken(),
      near: area?.center,
    })
      .catch(() => [])
      .then((found) => {
        if (!current) return
        setResults(found)
        setSearching(false)
      })
    return () => {
      current = false
    }
  }, [needle, area, sessionToken])

  const pick = (business: BusinessSuggestion) => {
    const token = sessionToken()
    renew()
    onChoose({
      name: business.name,
      address: business.address,
      prepared: prepareBusiness({
        placeId: business.placeId,
        sessionToken: token,
      }).catch((): PreparedBusiness => ({ ok: false, error: "failed" })),
    })
  }

  return (
    <div className={cn("flex flex-col gap-3", expanded && "min-h-0 flex-1")}>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setAreaOpen(true)}
          disabled={locating}
        >
          {locating ? (
            <Spinner data-icon="inline-start" />
          ) : area ? (
            <NavigationIcon data-icon="inline-start" />
          ) : (
            <MapPinIcon data-icon="inline-start" />
          )}
          {area?.label ?? "Anywhere"}
        </Button>
        {expanded && (
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Close search"
            onClick={onCollapse}
            className="ml-auto"
          >
            <XIcon />
          </Button>
        )}
      </div>
      {/* The home page's main box: taller and outlined on purpose. */}
      <InputGroup className="h-12 border-border bg-transparent dark:bg-transparent">
        <InputGroupAddon>
          {searching ? <Spinner /> : <SearchIcon />}
        </InputGroupAddon>
        <InputGroupInput
          {...noAutofill("business")}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => {
            askLocation()
            onExpand()
          }}
          placeholder="Your business name"
          className="text-base [&::-webkit-search-cancel-button]:appearance-none"
          aria-label="Your business name"
          enterKeyHint="search"
        />
        {query && (
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              size="icon-xs"
              aria-label="Clear"
              onClick={() => setQuery("")}
            >
              <XIcon />
            </InputGroupButton>
          </InputGroupAddon>
        )}
      </InputGroup>
      <div
        className={cn(
          expanded &&
            "-mx-1 flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-1"
        )}
      >
        {results && results.length === 0 && !searching && (
          <p className="px-1 text-sm text-muted-foreground">
            No business found
          </p>
        )}
        {results && results.length > 0 && (
          <SuggestionList
            items={results.map((business) => ({
              id: business.placeId,
              title: business.name,
              description: business.address,
            }))}
            onPick={(id) => {
              const business = results.find((found) => found.placeId === id)
              if (business) pick(business)
            }}
            icon={<MapPinIcon />}
            // Full screen: the Google Maps logo sits at the bottom left.
            className={cn(expanded && "flex-1")}
            creditClassName={expanded ? "mt-auto self-start" : undefined}
          />
        )}
      </div>
      <SearchAreaPanel
        open={areaOpen}
        onClose={() => setAreaOpen(false)}
        onPick={(next) => {
          setArea(next)
          setAreaOpen(false)
        }}
        locate={() => locate()}
        locating={locating}
      />
    </div>
  )
}

// The backup way in: a link shared from Google Maps.
function PasteLink({ onChoose }: { onChoose: (picked: Picked) => void }) {
  const [link, setLink] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (sending) return
    if (!link.trim()) {
      setError(ERRORS.invalid)
      return
    }
    setSending(true)
    setError("")
    const result = await prepareBusinessFromLink({ link }).catch(
      (): PreparedBusiness => ({ ok: false, error: "failed" })
    )
    setSending(false)
    if (!result.ok) {
      setError(ERRORS[result.error])
      return
    }
    onChoose({
      name: result.name,
      address: result.address,
      prepared: Promise.resolve(result),
    })
  }

  return (
    <form
      onSubmit={(event) => void submit(event)}
      noValidate
      className="flex flex-col gap-3"
    >
      <Field data-invalid={Boolean(error) || undefined}>
        <InputGroup className="h-12 border-border bg-transparent dark:bg-transparent">
          <InputGroupAddon>
            <LinkIcon />
          </InputGroupAddon>
          <InputGroupInput
            {...noAutofill("maps_link")}
            type="url"
            inputMode="url"
            value={link}
            onChange={(event) => setLink(event.target.value)}
            placeholder="https://maps.app.goo.gl/…"
            className="text-base"
            aria-label="Google Maps link"
            aria-invalid={Boolean(error) || undefined}
            autoFocus
          />
        </InputGroup>
        {error && <FieldError>{error}</FieldError>}
      </Field>
      <Button type="submit" size="lg" disabled={sending}>
        {sending && <Spinner data-icon="inline-start" />}
        Continue
      </Button>
    </form>
  )
}
