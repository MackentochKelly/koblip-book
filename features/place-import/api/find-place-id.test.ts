// @vitest-environment node
import { afterEach, beforeEach, expect, test, vi } from "vitest"

vi.mock("server-only", () => ({}))

const { findPlaceId, placeQueryFromUrl } = await import("./find-place-id")

const originalFetch = globalThis.fetch

beforeEach(() => {
  vi.stubEnv("GOOGLE_MAPS_PLATFORM_KEY", "test-key")
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  globalThis.fetch = originalFetch
})

function noRedirect(url: string) {
  return {
    url,
    headers: { get: () => null },
  }
}

function redirectTo(location: string) {
  return {
    url: "",
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "location" ? location : null,
    },
  }
}

function mockFetch(handler: (url: string, init?: RequestInit) => unknown) {
  globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
    const result = handler(url, init)
    return result as Response
  }) as typeof fetch
}

test("uses query_place_id straight from a Maps link", async () => {
  const finalUrl =
    "https://www.google.com/maps/search/?api=1&query=Barbarock&query_place_id=ChIJdirect123"
  mockFetch((url) => {
    expect(url).toBe(
      "https://www.google.com/maps/search/?api=1&query=Barbarock&query_place_id=ChIJdirect123"
    )
    return noRedirect(finalUrl)
  })

  await expect(
    findPlaceId(
      "https://www.google.com/maps/search/?api=1&query=Barbarock&query_place_id=ChIJdirect123"
    )
  ).resolves.toBe("ChIJdirect123")
  expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  expect(globalThis.fetch).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({
      redirect: "manual",
      headers: { "User-Agent": expect.any(String) },
    })
  )
})

test("resolves a short link through its place name and coordinates", async () => {
  const finalUrl =
    "https://www.google.com/maps/place/Barbarock+Barbershop+Churchill/@18.4812,-69.9381,17z/data=!4m1"
  let searchBody: Record<string, unknown> | undefined
  mockFetch((url, init) => {
    if (url === "https://maps.app.goo.gl/abc123") {
      return redirectTo(finalUrl)
    }
    if (url === finalUrl) {
      return noRedirect(finalUrl)
    }
    searchBody = JSON.parse(init?.body as string) as Record<string, unknown>
    return {
      ok: true,
      json: async () => ({ places: [{ id: "ChIJfromSearch" }] }),
    }
  })

  await expect(findPlaceId("https://maps.app.goo.gl/abc123")).resolves.toBe(
    "ChIJfromSearch"
  )
  expect(searchBody).toMatchObject({
    textQuery: "Barbarock Barbershop Churchill",
    pageSize: 1,
    locationBias: {
      circle: {
        center: { latitude: 18.4812, longitude: -69.9381 },
        radius: 500,
      },
    },
  })
})

test("follows a redirect chain hop by hop, with query params intact", async () => {
  const finalUrl =
    "https://www.google.com/maps/place/Davida+Salon/@18.47,-69.93,17z/?g_st=abc"
  const seen: string[] = []
  mockFetch((url, init) => {
    seen.push(url)
    if (url === "https://maps.app.goo.gl/short1?g_st=abc") {
      return redirectTo("https://maps.app.goo.gl/short2")
    }
    if (url === "https://maps.app.goo.gl/short2") {
      return redirectTo(finalUrl)
    }
    if (url === finalUrl) {
      return noRedirect(finalUrl)
    }
    const body = JSON.parse(init?.body as string) as Record<string, unknown>
    expect(body.textQuery).toBe("Davida Salon")
    return {
      ok: true,
      json: async () => ({ places: [{ id: "ChIJchain" }] }),
    }
  })

  await expect(
    findPlaceId("https://maps.app.goo.gl/short1?g_st=abc")
  ).resolves.toBe("ChIJchain")
  expect(seen.slice(0, 2)).toEqual([
    "https://maps.app.goo.gl/short1?g_st=abc",
    "https://maps.app.goo.gl/short2",
  ])
})

test("takes the continue param instead of fetching consent.google.com", async () => {
  const placeUrl =
    "https://www.google.com/maps/search/?api=1&query=Spa&query_place_id=ChIJconsent1"
  const consentUrl = `https://consent.google.com/m?continue=${encodeURIComponent(placeUrl)}&gl=DO`
  const calls: string[] = []
  mockFetch((url) => {
    calls.push(url)
    if (url === "https://maps.app.goo.gl/consent1") {
      return redirectTo(consentUrl)
    }
    if (url === placeUrl) {
      return noRedirect(placeUrl)
    }
    throw new Error(`should not fetch ${url}`)
  })

  await expect(findPlaceId("https://maps.app.goo.gl/consent1")).resolves.toBe(
    "ChIJconsent1"
  )
  expect(calls).toEqual([
    "https://maps.app.goo.gl/consent1",
    placeUrl,
  ])
  expect(calls.some((url) => url.includes("consent.google.com"))).toBe(false)
})

test("stops after 5 hops", async () => {
  const calls: string[] = []
  mockFetch((url) => {
    calls.push(url)
    const hop = Number(new URL(url).searchParams.get("hop") ?? "0")
    if (hop < 4) {
      return redirectTo(`https://maps.app.goo.gl/chain?hop=${hop + 1}`)
    }
    return redirectTo(
      "https://www.google.com/maps/search/?api=1&query=Hop&query_place_id=ChIJhop"
    )
  })

  await expect(
    findPlaceId("https://maps.app.goo.gl/chain?hop=0")
  ).resolves.toBe("ChIJhop")
  expect(calls.filter((url) => url.includes("goo.gl"))).toHaveLength(5)
})

test("searches plain text directly", async () => {
  let searchBody: Record<string, unknown> | undefined
  mockFetch((_url, init) => {
    searchBody = JSON.parse(init?.body as string) as Record<string, unknown>
    return {
      ok: true,
      json: async () => ({ places: [{ id: "ChIJplain" }] }),
    }
  })

  await expect(
    findPlaceId("Barbarock Barbershop Churchill Santo Domingo")
  ).resolves.toBe("ChIJplain")
  expect(searchBody).toMatchObject({
    textQuery: "Barbarock Barbershop Churchill Santo Domingo",
    pageSize: 1,
  })
  expect(searchBody).not.toHaveProperty("locationBias")
})

test("throws No business found when nothing matches", async () => {
  mockFetch(() => ({
    ok: true,
    json: async () => ({ places: [] }),
  }))

  await expect(
    findPlaceId("Some place that does not exist anywhere")
  ).rejects.toThrow("No business found")
})

test("placeQueryFromUrl reads query_place_id", () => {
  expect(
    placeQueryFromUrl(
      "https://www.google.com/maps/search/?api=1&query=Barbarock&query_place_id=ChIJdirect123"
    )
  ).toEqual({ kind: "placeId", placeId: "ChIJdirect123" })
})

test("placeQueryFromUrl reads place_id: text", () => {
  expect(
    placeQueryFromUrl(
      "https://www.google.com/maps/search/?api=1&query=Barbarock&place_id:ChIJtext456"
    )
  ).toEqual({ kind: "placeId", placeId: "ChIJtext456" })
})

test("placeQueryFromUrl reads a place name with @lat,lng", () => {
  expect(
    placeQueryFromUrl(
      "https://www.google.com/maps/place/Davida+Salon/@18.4712,-69.9312,17z/data=!3m1!4b1"
    )
  ).toEqual({
    kind: "text",
    text: "Davida Salon",
    latitude: 18.4712,
    longitude: -69.9312,
  })
})

test("placeQueryFromUrl reads a place name with !3d/!4d coordinates", () => {
  expect(
    placeQueryFromUrl(
      "https://www.google.com/maps/place/Davida+Salon/data=!4m2!3d18.4712!4d-69.9312"
    )
  ).toEqual({
    kind: "text",
    text: "Davida Salon",
    latitude: 18.4712,
    longitude: -69.9312,
  })
})

test("placeQueryFromUrl reads the q param", () => {
  expect(
    placeQueryFromUrl(
      "https://www.google.com/maps/search/?q=Davida+Salon,+123+Main+St"
    )
  ).toEqual({ kind: "text", text: "Davida Salon, 123 Main St" })
})

test("placeQueryFromUrl reads a place name without coordinates", () => {
  expect(
    placeQueryFromUrl("https://www.google.com/maps/place/Davida+Salon/")
  ).toEqual({ kind: "text", text: "Davida Salon" })
})

test("placeQueryFromUrl prefers coords over the q param", () => {
  expect(
    placeQueryFromUrl(
      "https://www.google.com/maps/place/Davida+Salon/@18.4712,-69.9312,17z/?q=Other+Name"
    )
  ).toEqual({
    kind: "text",
    text: "Davida Salon",
    latitude: 18.4712,
    longitude: -69.9312,
  })
})

test("placeQueryFromUrl unwraps a consent.google.com continue param", () => {
  const placeUrl =
    "https://www.google.com/maps/place/Davida+Salon/@18.4712,-69.9312,17z/"
  const consentUrl = `https://consent.google.com/ml?continue=${encodeURIComponent(placeUrl)}&gl=DO&hl=en`
  expect(placeQueryFromUrl(consentUrl)).toEqual({
    kind: "text",
    text: "Davida Salon",
    latitude: 18.4712,
    longitude: -69.9312,
  })
})

test("placeQueryFromUrl returns null when nothing is found", () => {
  expect(placeQueryFromUrl("https://www.google.com/maps/")).toBeNull()
  expect(placeQueryFromUrl("not a url")).toBeNull()
  expect(placeQueryFromUrl("https://consent.google.com/m?gl=DO")).toBeNull()
})
