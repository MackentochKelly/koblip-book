"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
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
import { AuthForm } from "@/features/owner-auth/components/auth-form"
import { ONBOARDING_RULES } from "@/lib/onboarding-rules"
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
  owned: "Someone already manages this business",
  failed: "That did not work. Please try again.",
} as const

type Mode = "search" | "link"

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
}: {
  signedIn: boolean
  claim: (slug: string) => Promise<ClaimResult>
}) {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>("search")
  const [picked, setPicked] = useState<Picked | null>(null)
  const [prepared, setPrepared] = useState<PreparedBusiness | null>(null)
  const [error, setError] = useState("")
  const [finishing, setFinishing] = useState(false)

  const choose = (next: Picked) => {
    setPicked(next)
    setPrepared(null)
    setError("")
    void next.prepared.then((result) => {
      setPrepared(result)
      if (!result.ok) setError(ERRORS[result.error])
      else if (result.owned) setError(ERRORS.owned)
    })
    if (signedIn) void finish(next)
  }

  // After login (or straight away when already logged in): wait for the
  // page, make it the owner's, open its dashboard.
  const finish = async (current: Picked | null = picked) => {
    if (!current) return
    setFinishing(true)
    const result = await current.prepared
    if (!result.ok || result.owned) {
      setFinishing(false)
      return
    }
    const claimed = await claim(result.slug).catch(() => null)
    if (!claimed?.ok) {
      setError(claimed?.error === "owned" ? ERRORS.owned : ERRORS.failed)
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
          listClassName="h-11! border border-background/30 *:h-full bg-background/35 p-1 dark:bg-background/60 backdrop-blur-md"
        />
      )}
      {/* A frosted glass frame around the card, like Fresha's: it blurs
          the gradient behind it and draws a faint edge; no drop shadow. */}
      <div className="w-full rounded-[calc(var(--radius-4xl)+--spacing(1.5))] p-1.5 inset-ring-6 inset-ring-foreground/8 backdrop-blur-md backdrop-saturate-(--glass-saturate)">
        <Card className="text-left shadow-none ring-0">
          <CardContent>{content}</CardContent>
        </Card>
      </div>
      {!picked && (
        <p className="flex items-center gap-2 text-sm font-medium">
          <CornerLeftUpIcon className="size-4" />
          Try it with your business
        </p>
      )}
    </div>
  )

  if (!picked) {
    return box(
      mode === "link" ? (
        <PasteLink onChoose={choose} />
      ) : (
        <FindBusiness onChoose={choose} />
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
          <AuthForm onSignedIn={() => finish()} disabled={finishing} />
          <Button variant="ghost" onClick={back} disabled={finishing}>
            Not your business?
          </Button>
        </>
      )}
    </div>
  )
}

// Search as you type, near the owner or a city they pick.
function FindBusiness({ onChoose }: { onChoose: (picked: Picked) => void }) {
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
    <div className="flex flex-col gap-3">
      <div>
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
      </div>
      {/* The home page's main box: taller and outlined on purpose. */}
      <InputGroup className="h-12 border-border bg-transparent dark:bg-transparent">
        <InputGroupAddon>
          {searching ? <Spinner /> : <SearchIcon />}
        </InputGroupAddon>
        <InputGroupInput
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={askLocation}
          placeholder="Your business name"
          className="text-base"
          aria-label="Your business name"
          autoComplete="off"
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
      {results && results.length === 0 && !searching && (
        <p className="px-1 text-sm text-muted-foreground">No business found</p>
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
        />
      )}
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
            type="url"
            inputMode="url"
            value={link}
            onChange={(event) => setLink(event.target.value)}
            placeholder="https://maps.app.goo.gl/…"
            className="text-base"
            aria-label="Google Maps link"
            aria-invalid={Boolean(error) || undefined}
            autoComplete="off"
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
