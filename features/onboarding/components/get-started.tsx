"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import {
  ArrowLeftIcon,
  LinkIcon,
  MapPinIcon,
  NavigationIcon,
  SearchIcon,
  StoreIcon,
  XIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
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
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { Spinner } from "@/components/ui/spinner"
import { AuthForm } from "@/features/owner-auth/components/auth-form"
import {
  prepareBusiness,
  prepareBusinessFromLink,
} from "../api/prepare-actions"
import { searchBusinesses } from "../api/search-actions"
import type { BusinessSuggestion, PreparedBusiness } from "../types"
import { useDebounced } from "../utils/use-debounced"
import { useSessionToken } from "../utils/use-session-token"
import { SearchAreaPanel, type SearchArea } from "./search-area"

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

  if (!picked) {
    return <FindBusiness onChoose={choose} />
  }

  const ready = prepared?.ok ? prepared : null
  const blocked = Boolean(error)
  return (
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

// Search as you type, near the owner or a city they pick; or a Maps link.
function FindBusiness({ onChoose }: { onChoose: (picked: Picked) => void }) {
  const [mode, setMode] = useState<"search" | "link">("search")
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<BusinessSuggestion[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [area, setArea] = useState<SearchArea | null>(null)
  const [areaOpen, setAreaOpen] = useState(false)
  const [locating, setLocating] = useState(false)
  const asked = useRef(false)
  const { current: sessionToken, renew } = useSessionToken()
  const needle = useDebounced(query.trim(), 250)

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
    if (mode !== "search" || needle.length < 2) {
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
  }, [needle, area, mode, sessionToken])

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

  if (mode === "link") {
    return <PasteLink onChoose={onChoose} onSearch={() => setMode("search")} />
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
      <InputGroup className="h-12">
        <InputGroupAddon>
          {searching ? <Spinner /> : <SearchIcon />}
        </InputGroupAddon>
        <InputGroupInput
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={askLocation}
          placeholder="Your business name"
          aria-label="Your business name"
          autoComplete="off"
          enterKeyHint="search"
          className="text-base"
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
        <ItemGroup className="gap-1">
          {results.map((business) => (
            <Item
              key={business.placeId}
              size="sm"
              render={<button type="button" onClick={() => pick(business)} />}
              className="text-left hover:bg-muted"
            >
              <ItemMedia variant="icon">
                <MapPinIcon />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{business.name}</ItemTitle>
                {business.address && (
                  <ItemDescription className="line-clamp-1">
                    {business.address}
                  </ItemDescription>
                )}
              </ItemContent>
            </Item>
          ))}
        </ItemGroup>
      )}
      <Button
        variant="link"
        size="sm"
        className="self-center"
        onClick={() => setMode("link")}
      >
        <LinkIcon data-icon="inline-start" />
        Paste a Google Maps link
      </Button>
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
function PasteLink({
  onChoose,
  onSearch,
}: {
  onChoose: (picked: Picked) => void
  onSearch: () => void
}) {
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
        <InputGroup className="h-12">
          <InputGroupAddon>
            <LinkIcon />
          </InputGroupAddon>
          <InputGroupInput
            type="url"
            inputMode="url"
            value={link}
            onChange={(event) => setLink(event.target.value)}
            placeholder="https://maps.app.goo.gl/…"
            aria-label="Google Maps link"
            aria-invalid={Boolean(error) || undefined}
            autoComplete="off"
            autoFocus
            className="text-base"
          />
        </InputGroup>
        {error && <FieldError>{error}</FieldError>}
      </Field>
      <Button type="submit" size="lg" disabled={sending}>
        {sending && <Spinner data-icon="inline-start" />}
        Continue
      </Button>
      <Button
        variant="link"
        size="sm"
        className="self-center"
        onClick={onSearch}
      >
        <SearchIcon data-icon="inline-start" />
        Search by name instead
      </Button>
    </form>
  )
}
