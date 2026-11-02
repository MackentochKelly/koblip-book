"use client"

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  ViewTransition,
} from "react"
import { flushSync } from "react-dom"
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
} from "@/components/ui/icons"

import {
  glassClassName,
  glassEdgeClassName,
  glassFrameClassName,
} from "@/components/glass-frame"
import { ViewTabs, type ViewTab } from "@/components/view-tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
import { useMarkFullScreen } from "@/hooks/use-full-screen"
import { useTypingPlaceholder } from "@/features/onboarding/hooks/use-typing-placeholder"
import { AuthForm } from "@/features/owner-auth/components/auth-form"
import { ONBOARDING_RULES } from "@/lib/onboarding-rules"
import { cn } from "@/lib/utils"
import {
  prepareBusiness,
  prepareBusinessFromLink,
} from "../api/prepare-actions"
import { searchBusinesses, searchBusinessesByText } from "../api/search-actions"
import type {
  BusinessSearchResult,
  BusinessSuggestion,
  FoundBusiness,
  PreparedBusiness,
} from "../types"
import { signUpHref } from "../utils/sign-up-link"
import { useDebounced } from "../utils/use-debounced"
import { useSessionToken } from "../utils/use-session-token"
import { SearchAreaPanel, type SearchArea } from "./search-area"
import { SuggestionList } from "./suggestion-list"
import { noAutofill } from "@/lib/no-autofill"
import type { PageLanguage } from "@/lib/page-language"
import { onboardingWordsFor, type OnboardingWords } from "../i18n"

type ClaimResult =
  { ok: true; businessId: string } | { ok: false; error: string }

interface Picked {
  name: string
  address: string | null
  prepared: Promise<PreparedBusiness>
}

// A business found by the search or a pasted link, and how to build its
// page: only called where the owner signs up.
type Choose = (
  found: FoundBusiness,
  prepare: () => Promise<PreparedBusiness>
) => void

type Mode = "search" | "link"

// On a phone the search box grows into a full screen search when tapped
// (Motion layout animation: motion.dev/docs/react-layout-animations).
const GROW = { type: "spring", bounce: 0, duration: 0.4 } as const
// The page colour fades in behind the full screen search faster than it
// grows, so it is in place before the keyboard opens and Safari moves the page.
const COVER = { duration: 0.2, ease: "easeOut" } as const
const MotionCard = motion.create(Card)

// The home page's one box: find your business (or paste its Maps link),
// tap it, sign up. The page is built while the owner signs up, then the
// business becomes theirs and its dashboard opens.
export function GetStarted({
  signedIn,
  claim,
  resume = null,
  hint = true,
  handOver = false,
  start,
  language,
}: {
  signedIn: boolean
  claim: (slug: string) => Promise<ClaimResult>
  // Back from Google login: the page to make the owner's.
  resume?: string | null
  hint?: boolean
  // The home page: a signed-out owner who picks their business goes on to
  // the sign-up page, which fades in with this box.
  handOver?: boolean
  // The sign-up page: the business the owner picked on the home page,
  // built on the server while they sign up.
  start?: Picked
  language: PageLanguage
}) {
  const t = onboardingWordsFor(language)
  const modes: ViewTab<Mode>[] = [
    { id: "search", label: t.modes.search, icon: <SearchIcon /> },
    { id: "link", label: t.modes.link, icon: <LinkIcon /> },
  ]
  const router = useRouter()
  const [mode, setMode] = useState<Mode>("search")
  // The server's promise, made a plain one for `.then` and `await`.
  const [picked, setPicked] = useState<Picked | null>(() =>
    start ? { ...start, prepared: Promise.resolve(start.prepared) } : null
  )
  const [handingOver, startHandOver] = useTransition()
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

  // Back from Google: make the page the owner's and open the details check.
  useEffect(() => {
    if (!resume || !signedIn) return
    let current = true
    void claim(resume)
      .catch(() => null)
      .then((claimed) => {
        if (!current) return
        if (claimed?.ok) {
          router.replace(`/setup/${claimed.businessId}/google`)
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

  // The header and other floating parts step aside while it's open.
  useMarkFullScreen(open)

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

  // The picked business's page, once built. A pick dropped meanwhile
  // ("Not your business?") no longer applies.
  useEffect(() => {
    if (!picked) return
    let current = true
    void picked.prepared.then((result) => {
      if (!current) return
      setPrepared(result)
      if (!result.ok) setError(t.errors[result.error])
    })
    return () => {
      current = false
    }
  }, [picked, t])

  const choose: Choose = (found, prepare) => {
    // Signed out on the home page: the sign-up page takes over (a route
    // change, so React runs it as a view transition).
    if (handOver && !signedIn) {
      startHandOver(() => router.push(signUpHref(found)))
      return
    }
    const next = {
      name: found.name,
      address: found.address,
      prepared: prepare(),
    }
    setPicked(next)
    setPrepared(null)
    setError("")
    if (signedIn) void finish(next)
  }

  // After login (or straight away when already logged in): wait for the
  // page, make it the owner's, open the details check.
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
      setError(t.errors.failed)
      setFinishing(false)
      return
    }
    router.push(`/setup/${claimed.businessId}/google`)
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
          views={modes}
          value={mode}
          onChange={setMode}
          ariaLabel={t.modes.label}
          listClassName={cn(
            glassClassName,
            glassEdgeClassName,
            "h-11! border p-1 *:h-full"
          )}
        />
      )}
      {/* The shared glass frame around the card. While full screen,
          an empty space of its size keeps the page still. The same box on
          the home and sign-up pages: it morphs from one to the other
          (react.dev/reference/react/ViewTransition). */}
      <ViewTransition name="get-started" share="morph" default="none">
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
                    ...(visible && {
                      top: visible.top,
                      height: visible.height,
                    }),
                  }
                : rest.radius
                  ? { borderRadius: rest.radius }
                  : undefined
            }
            className={cn(
              glassFrameClassName,
              open &&
                "fixed inset-x-0 top-0 z-50 h-dvh bg-background p-0 pt-[env(safe-area-inset-top)] inset-ring-0"
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
              <CardContent
                className={cn(open && "flex min-h-0 flex-1 flex-col")}
              >
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
      </ViewTransition>
      {/* The home page's note; the dashboard hides it. */}
      {!picked && hint && (
        <p className="flex items-center gap-2 text-sm font-medium">
          <CornerLeftUpIcon className="size-4" />
          {t.hint}
        </p>
      )}
    </div>
  )

  if (resuming) {
    return box(
      <Button size="lg" disabled className="w-full">
        <Spinner data-icon="inline-start" />
        {t.building}
      </Button>
    )
  }

  if (!picked) {
    return box(
      mode === "link" ? (
        <PasteLink onChoose={choose} busy={handingOver} t={t} />
      ) : (
        <FindBusiness
          onChoose={(found, prepare) => {
            setExpanded(false)
            choose(found, prepare)
          }}
          busy={handingOver}
          expanded={open}
          onExpand={expand}
          onCollapse={collapse}
          t={t}
        />
      )
    )
  }

  const ready = prepared?.ok ? prepared : null
  const blocked = Boolean(error)
  return box(
    <div className="flex flex-col gap-5">
      <Item variant="muted" size="sm">
        <ItemMedia>
          {/* Avatar: the same bordered photo as team members. */}
          <Avatar size="lg">
            {ready?.photoUrl && <AvatarImage src={ready.photoUrl} alt="" />}
            <AvatarFallback>
              {prepared ? <StoreIcon /> : <Spinner />}
            </AvatarFallback>
          </Avatar>
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
            {t.searchAgain}
          </Button>
        </Field>
      ) : signedIn ? (
        <Button size="lg" disabled>
          <Spinner data-icon="inline-start" />
          {t.building}
        </Button>
      ) : (
        <>
          <AuthForm
            onSignedIn={() => finish()}
            disabled={finishing}
            googleNext={ready ? `/?claim=${ready.slug}` : undefined}
            googleReady={Boolean(ready)}
            language={language}
          />
          <Button variant="ghost" onClick={back} disabled={finishing}>
            {t.notYours}
          </Button>
        </>
      )}
    </div>
  )
}

// Search as you type, near the owner or a city they pick.
// A suggested search's row id: kept apart from Google place ids.
const queryId = (text: string) => `query:${text}`

function FindBusiness({
  onChoose,
  busy,
  expanded,
  onExpand,
  onCollapse,
  t,
}: {
  onChoose: Choose
  // The picked business's sign-up page is on its way: its row spins.
  busy: boolean
  expanded: boolean
  onExpand: () => void
  onCollapse: () => void
  t: OnboardingWords
}) {
  const [query, setQuery] = useState("")
  const [focused, setFocused] = useState(false)
  const placeholder = useTypingPlaceholder({
    lines: t.businessNameExamples,
    rest: t.businessName,
    paused: focused || query !== "",
  })
  const [results, setResults] = useState<BusinessSearchResult[] | null>(null)
  const [searching, setSearching] = useState(false)
  // The suggested search being run (its row shows a spinner).
  const [runningQuery, setRunningQuery] = useState<string | null>(null)
  const [pickedId, setPickedId] = useState<string | null>(null)
  // Bumped by each new search, so an older answer is dropped.
  const searchRun = useRef(0)
  const listRef = useRef<HTMLDivElement>(null)
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
          label: t.nearMe,
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
    // New words: a suggested search still running no longer applies.
    searchRun.current += 1
    if (needle.length < ONBOARDING_RULES.minInput) {
      queueMicrotask(() => {
        if (!current) return
        setResults(null)
        setSearching(false)
        setRunningQuery(null)
      })
      return () => {
        current = false
      }
    }
    queueMicrotask(() => {
      if (!current) return
      setSearching(true)
      setRunningQuery(null)
    })
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

  // A suggested search ("photography studio near Brockton, MA, USA"):
  // its businesses replace the list. The tapped row goes with the old
  // list, so focus moves to the first business (rendered first with
  // flushSync: react.dev/reference/react-dom/flushSync), unless the
  // owner has moved on to another control.
  const runQuery = (text: string) => {
    const run = ++searchRun.current
    setRunningQuery(text)
    void searchBusinessesByText({ text, near: area?.center })
      .catch(() => [])
      .then((found) => {
        if (run !== searchRun.current) return
        const active = document.activeElement
        const inList =
          !active ||
          active === document.body ||
          Boolean(listRef.current?.contains(active))
        flushSync(() => {
          setRunningQuery(null)
          setResults(
            found.map((business) => ({
              kind: "business" as const,
              ...business,
            }))
          )
        })
        if (inList) listRef.current?.querySelector("button")?.focus()
      })
  }

  const pick = (business: BusinessSuggestion) => {
    const found = {
      name: business.name,
      address: business.address,
      placeId: business.placeId,
      sessionToken: sessionToken(),
    }
    renew()
    setPickedId(business.placeId)
    onChoose(found, () =>
      prepareBusiness({
        placeId: found.placeId,
        sessionToken: found.sessionToken,
      }).catch((): PreparedBusiness => ({ ok: false, error: "failed" }))
    )
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
          {area?.label ?? t.anywhere}
        </Button>
        {expanded && (
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={t.closeSearch}
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
            setFocused(true)
            askLocation()
            onExpand()
          }}
          placeholder={placeholder}
          className="text-base [&::-webkit-search-cancel-button]:appearance-none"
          aria-label={t.businessName}
          enterKeyHint="search"
        />
        {query && (
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              size="icon-xs"
              aria-label={t.clear}
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
            "-mx-1 flex min-h-0 flex-1 scroll-fade flex-col overflow-y-auto overscroll-contain px-1"
        )}
      >
        {results && results.length === 0 && !searching && (
          <p className="px-1 text-sm text-muted-foreground">{t.noneFound}</p>
        )}
        {results && results.length > 0 && (
          <SuggestionList
            ref={listRef}
            items={results.map((result) =>
              result.kind === "query"
                ? {
                    id: queryId(result.text),
                    title: result.text,
                    description: null,
                    icon: <SearchIcon />,
                  }
                : {
                    id: result.placeId,
                    title: result.name,
                    description: result.address,
                  }
            )}
            busyId={
              runningQuery !== null
                ? queryId(runningQuery)
                : busy
                  ? pickedId
                  : null
            }
            onPick={(id) => {
              const result = results.find((found) =>
                found.kind === "query"
                  ? queryId(found.text) === id
                  : found.placeId === id
              )
              if (!result) return
              if (result.kind === "query") runQuery(result.text)
              else pick(result)
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
        words={t.area}
      />
    </div>
  )
}

// The backup way in: a link shared from Google Maps.
function PasteLink({
  onChoose,
  busy,
  t,
}: {
  onChoose: Choose
  busy: boolean
  t: OnboardingWords
}) {
  const [link, setLink] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (sending) return
    if (!link.trim()) {
      setError(t.errors.invalid)
      return
    }
    setSending(true)
    setError("")
    const result = await prepareBusinessFromLink({ link }).catch(
      (): PreparedBusiness => ({ ok: false, error: "failed" })
    )
    setSending(false)
    if (!result.ok) {
      setError(t.errors[result.error])
      return
    }
    onChoose(
      { name: result.name, address: result.address, slug: result.slug },
      () => Promise.resolve(result)
    )
  }
  const waiting = sending || busy

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
            aria-label={t.mapsLink}
            aria-invalid={Boolean(error) || undefined}
            autoFocus
          />
        </InputGroup>
        {error && <FieldError>{error}</FieldError>}
      </Field>
      <Button type="submit" size="lg" disabled={waiting}>
        {waiting && <Spinner data-icon="inline-start" />}
        {t.continue}
      </Button>
    </form>
  )
}
