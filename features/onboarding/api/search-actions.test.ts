// @vitest-environment node
import { afterEach, beforeEach, expect, test, vi } from "vitest"

import { ONBOARDING_RULES } from "@/lib/onboarding-rules"

vi.mock("server-only", () => ({}))

const { autocompleteMock } = vi.hoisted(() => ({ autocompleteMock: vi.fn() }))

vi.mock("./places-autocomplete", () => ({ autocomplete: autocompleteMock }))

const { searchBusinesses, searchCities, cityCenter } =
  await import("./search-actions")

const TOKEN = "123e4567-e89b-42d3-a456-426614174000"

function prediction(placeId: string, mainText: string, secondary = "Addr") {
  return { placeId, mainText, secondaryText: secondary }
}

beforeEach(() => {
  vi.stubEnv("GOOGLE_MAPS_PLATFORM_KEY", "test-key")
  autocompleteMock.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

test("searchBusinesses returns name + address suggestions", async () => {
  autocompleteMock.mockResolvedValue([
    prediction("ChIJ1", "Davida Salon", "123 Main St"),
    { placeId: "ChIJ2", mainText: "Other", secondaryText: null },
  ])

  await expect(
    searchBusinesses({ input: "davida", sessionToken: TOKEN })
  ).resolves.toEqual([
    { placeId: "ChIJ1", name: "Davida Salon", address: "123 Main St" },
    { placeId: "ChIJ2", name: "Other", address: null },
  ])
  expect(autocompleteMock).toHaveBeenCalledTimes(1)
  expect(autocompleteMock).toHaveBeenCalledWith({
    input: "davida",
    sessionToken: TOKEN,
    languageCode: "en",
  })
})

test("searchBusinesses sends locationBias only with valid coordinates", async () => {
  autocompleteMock.mockResolvedValue([])

  await searchBusinesses({
    input: "davida",
    sessionToken: TOKEN,
    near: { latitude: 18.47, longitude: -69.93 },
  })
  expect(autocompleteMock).toHaveBeenCalledWith({
    input: "davida",
    sessionToken: TOKEN,
    languageCode: "en",
    locationBias: {
      circle: {
        center: { latitude: 18.47, longitude: -69.93 },
        radius: ONBOARDING_RULES.biasRadiusMeters,
      },
    },
  })

  autocompleteMock.mockClear()
  await searchBusinesses({
    input: "davida",
    sessionToken: TOKEN,
    near: { latitude: 91, longitude: -69.93 },
  })
  expect(autocompleteMock).toHaveBeenCalledWith({
    input: "davida",
    sessionToken: TOKEN,
    languageCode: "en",
  })
})

test("searchBusinesses rejects bad input and bad tokens", async () => {
  autocompleteMock.mockResolvedValue([prediction("ChIJ1", "A")])

  for (const input of ["", "a", "x".repeat(ONBOARDING_RULES.maxInput + 1)]) {
    await expect(
      searchBusinesses({ input, sessionToken: TOKEN })
    ).resolves.toEqual([])
  }
  for (const sessionToken of ["", "short", "x".repeat(65), "has space!"]) {
    await expect(
      searchBusinesses({ input: "davida", sessionToken })
    ).resolves.toEqual([])
  }
  expect(autocompleteMock).not.toHaveBeenCalled()
})

test("searchBusinesses caps at 5 and returns [] on Google errors", async () => {
  autocompleteMock.mockResolvedValue(
    Array.from({ length: ONBOARDING_RULES.maxResults + 2 }, (_, i) =>
      prediction(`ChIJ${i}`, `Shop ${i}`)
    )
  )
  const results = await searchBusinesses({
    input: "shop",
    sessionToken: TOKEN,
  })
  expect(results).toHaveLength(ONBOARDING_RULES.maxResults)

  const error = vi.spyOn(console, "error").mockImplementation(() => {})
  autocompleteMock.mockRejectedValueOnce(new Error("quota exploded"))
  await expect(
    searchBusinesses({ input: "shop", sessionToken: TOKEN })
  ).resolves.toEqual([])
  expect(error).toHaveBeenCalledTimes(1)
  expect(error).toHaveBeenCalledWith("quota exploded")
})

test("searchCities uses the cities type and maps region", async () => {
  autocompleteMock.mockResolvedValue([
    prediction("ChIJc", "Santo Domingo", "Dominican Republic"),
  ])

  await expect(
    searchCities({ input: "santo", sessionToken: TOKEN })
  ).resolves.toEqual([
    {
      placeId: "ChIJc",
      name: "Santo Domingo",
      region: "Dominican Republic",
    },
  ])
  expect(autocompleteMock).toHaveBeenCalledWith({
    input: "santo",
    sessionToken: TOKEN,
    languageCode: "en",
    includedPrimaryTypes: ["(cities)"],
  })
})

test("searchCities rejects bad input and returns [] on error", async () => {
  await expect(
    searchCities({ input: "x", sessionToken: TOKEN })
  ).resolves.toEqual([])
  await expect(
    searchCities({ input: "santo", sessionToken: "bad token!" })
  ).resolves.toEqual([])
  expect(autocompleteMock).not.toHaveBeenCalled()

  const error = vi.spyOn(console, "error").mockImplementation(() => {})
  autocompleteMock.mockRejectedValueOnce(new Error("denied"))
  await expect(
    searchCities({ input: "santo", sessionToken: TOKEN })
  ).resolves.toEqual([])
  expect(error).toHaveBeenCalledTimes(1)
})

test("cityCenter returns the city coordinates", async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = vi.fn(
    async () =>
      ({
        ok: true,
        json: async () => ({
          location: { latitude: 18.4861, longitude: -69.9312 },
        }),
      }) as Response
  ) as typeof fetch
  try {
    await expect(
      cityCenter({ placeId: "ChIJcityCenter01", sessionToken: TOKEN })
    ).resolves.toEqual({ latitude: 18.4861, longitude: -69.9312 })
    expect(globalThis.fetch).toHaveBeenCalledWith(
      `https://places.googleapis.com/v1/places/ChIJcityCenter01?languageCode=en&sessionToken=${TOKEN}`,
      expect.objectContaining({
        headers: expect.objectContaining({ "X-Goog-FieldMask": "location" }),
      })
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("cityCenter returns null on error", async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = vi.fn(
    async () => ({ ok: false }) as Response
  ) as typeof fetch
  try {
    await expect(
      cityCenter({ placeId: "ChIJcityCenter01", sessionToken: TOKEN })
    ).resolves.toBeNull()
  } finally {
    globalThis.fetch = originalFetch
  }

  await expect(
    cityCenter({ placeId: "", sessionToken: TOKEN })
  ).resolves.toBeNull()
  await expect(
    cityCenter({ placeId: "ChIJcityCenter01", sessionToken: "bad token!" })
  ).resolves.toBeNull()
})
