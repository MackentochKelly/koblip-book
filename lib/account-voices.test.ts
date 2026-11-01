// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  expect,
  test,
  vi,
} from "vitest"
import { ownerVoices, user } from "@/lib/db/schema"

const { search, client, unstableCache, resetCache } = vi.hoisted(() => {
  const search = vi.fn()
  const client = vi.fn(function () {
    return { voices: { search } }
  })
  const entries = new Map<string, unknown>()
  const unstableCache = vi.fn(
    (load: () => Promise<unknown>, keys: string[]) => async () => {
      const key = JSON.stringify(keys)
      if (entries.has(key)) return entries.get(key)
      const value = await load()
      entries.set(key, value)
      return value
    }
  )
  return { search, client, unstableCache, resetCache: () => entries.clear() }
})
vi.mock("server-only", () => ({}))
vi.mock("@elevenlabs/elevenlabs-js", () => ({ ElevenLabsClient: client }))
vi.mock("next/cache", () => ({ unstable_cache: unstableCache }))

const { getAccountVoices, isAccountVoice, getOwnerVoiceId } =
  await import("./account-voices")
let dir: string
let db: (typeof import("@/lib/db"))["db"]

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-voices-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  db = (await import("@/lib/db")).db
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  await migrate(db, { migrationsFolder: "drizzle" })
  await db.insert(user).values({ id: "u1", name: "Owner", email: "o@x.com" })
})
afterAll(() => {
  db.$client.close()
  rmSync(dir, { recursive: true, force: true })
})
beforeEach(async () => {
  resetCache()
  search.mockReset().mockResolvedValue({ voices: [], hasMore: false })
  client.mockClear()
  vi.stubEnv("ELEVENLABS_API_KEY", "test-key")
  vi.spyOn(console, "error").mockImplementation(() => {})
  await db.delete(ownerVoices)
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

test("reads every non-default page, maps picker fields and sorts by name", async () => {
  search
    .mockResolvedValueOnce({
      voices: [
        {
          voiceId: "v2",
          name: "Zoe",
          previewUrl: "https://preview.test/zoe",
          labels: { accent: "american" },
          verifiedLanguages: [
            { language: "en", modelId: "a" },
            { language: "es", modelId: "a" },
            { language: "en", modelId: "b" },
          ],
          description: "unused",
        },
      ],
      hasMore: true,
      nextPageToken: "page-2",
    })
    .mockResolvedValueOnce({
      voices: [{ voiceId: "v1", name: "Ana" }],
      hasMore: true,
      nextPageToken: "page-3",
    })
    .mockResolvedValueOnce({ voices: [{ voiceId: "v3" }], hasMore: false })
  const voices = await getAccountVoices()
  expect(voices).toEqual([
    { voiceId: "v1", name: "Ana", previewUrl: null, labels: {}, languages: [] },
    { voiceId: "v3", name: "v3", previewUrl: null, labels: {}, languages: [] },
    {
      voiceId: "v2",
      name: "Zoe",
      previewUrl: "https://preview.test/zoe",
      labels: { accent: "american" },
      languages: ["en", "es"],
    },
  ])
  expect(JSON.parse(JSON.stringify(voices))).toEqual(voices)
  expect(client).toHaveBeenCalledWith({ apiKey: "test-key" })
  expect(search.mock.calls).toEqual([
    [{ voiceType: "non-default", pageSize: 100, nextPageToken: undefined }],
    [{ voiceType: "non-default", pageSize: 100, nextPageToken: "page-2" }],
    [{ voiceType: "non-default", pageSize: 100, nextPageToken: "page-3" }],
  ])
})

test("lists are cached for an hour with a tag", async () => {
  await getAccountVoices()
  await getAccountVoices()
  expect(search).toHaveBeenCalledTimes(1)
  expect(unstableCache).toHaveBeenCalledWith(
    expect.any(Function),
    ["elevenlabs-voices"],
    {
      tags: ["elevenlabs-voices"],
      revalidate: 3600,
    }
  )
})

test("a missing key returns null without calling the SDK", async () => {
  delete process.env.ELEVENLABS_API_KEY
  expect(await getAccountVoices()).toBeNull()
  expect(client).not.toHaveBeenCalled()
  expect(console.error).toHaveBeenCalledExactlyOnceWith("voices-unavailable")
})

test("a failed later page returns null, logs no body and is not cached", async () => {
  search
    .mockResolvedValueOnce({
      voices: [{ voiceId: "v1", name: "Ana" }],
      hasMore: true,
      nextPageToken: "page-2",
    })
    .mockRejectedValueOnce(new Error("private response and test-key"))
  expect(await getAccountVoices()).toBeNull()
  expect(console.error).toHaveBeenCalledExactlyOnceWith("voices-unavailable")
  expect(await getAccountVoices()).toEqual([])
  expect(search).toHaveBeenCalledTimes(3)
})

test("a missing next page token does not return a partial list", async () => {
  search.mockResolvedValue({ voices: [], hasMore: true })
  expect(await getAccountVoices()).toBeNull()
})

test("provider details never reach cache revalidation errors", async () => {
  search.mockRejectedValue(new Error("private response and test-key"))
  const load = unstableCache.mock.calls[0][0]
  await expect(load()).rejects.toEqual(new Error("voices-unavailable"))
})

test("isAccountVoice accepts only account ids and refuses an unavailable list", async () => {
  search.mockResolvedValue({
    voices: [{ voiceId: "v1", name: "Ana" }],
    hasMore: false,
  })
  expect(await isAccountVoice("v1")).toBe(true)
  expect(await isAccountVoice("other")).toBe(false)
  resetCache()
  search.mockRejectedValue(new Error("unavailable"))
  expect(await isAccountVoice("v1")).toBe(false)
})

test("an owner without a saved voice has none", async () => {
  expect(await getOwnerVoiceId("u1")).toBeNull()
  expect(search).not.toHaveBeenCalled()
})

test("an owner's saved voice is usable only while in the account list", async () => {
  await db.insert(ownerVoices).values({ ownerId: "u1", voiceId: "v1" })
  search.mockResolvedValue({
    voices: [{ voiceId: "v1", name: "Ana" }],
    hasMore: false,
  })
  expect(await getOwnerVoiceId("u1")).toBe("v1")
  resetCache()
  search.mockResolvedValue({ voices: [], hasMore: false })
  expect(await getOwnerVoiceId("u1")).toBeNull()
})
