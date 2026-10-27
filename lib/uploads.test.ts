// @vitest-environment node
import { mkdtempSync, readdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, expect, test, vi } from "vitest"

vi.mock("server-only", () => ({}))

const { UPLOAD_RULES } = await import("./upload-rules")
const { deletePhoto, readPhoto, savePhoto, uploadsDir } = await import("./uploads")

function fileWithBytes(bytes: Uint8Array, type: string, name: string): File {
  return new File([new Uint8Array(bytes)], name, { type })
}

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x01, 0x02, 0x03])
const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01, 0x02,
])
const WEBP = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x0a, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
  0x01, 0x02,
])
const TEXT = new TextEncoder().encode("hello, this is plain text")

let dir: string

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "koblip-uploads-test-"))
  vi.stubEnv("UPLOADS_DIR", dir)
})

afterAll(() => {
  vi.unstubAllEnvs()
  rmSync(dir, { recursive: true, force: true })
})

test("uploadsDir uses UPLOADS_DIR when set", () => {
  expect(uploadsDir()).toBe(dir)
})

test("saves real JPEG/PNG/WebP bytes with the matching extension", async () => {
  const jpg = await savePhoto(fileWithBytes(JPEG, "image/jpeg", "a.jpg"))
  expect(jpg.ok).toBe(true)
  if (!jpg.ok) return
  expect(jpg.url).toMatch(/^\/uploads\/[0-9a-f-]{36}\.jpg$/)

  const png = await savePhoto(fileWithBytes(PNG, "image/png", "b.png"))
  expect(png.ok).toBe(true)
  if (!png.ok) return
  expect(png.url).toMatch(/^\/uploads\/[0-9a-f-]{36}\.png$/)

  const webp = await savePhoto(fileWithBytes(WEBP, "image/webp", "c.webp"))
  expect(webp.ok).toBe(true)
  if (!webp.ok) return
  expect(webp.url).toMatch(/^\/uploads\/[0-9a-f-]{36}\.webp$/)
})

test("trusts the bytes, not file.type or the file name", async () => {
  // PNG bytes sent as an untyped upload still save as .png.
  const renamed = await savePhoto(fileWithBytes(PNG, "", "evil.jpg"))
  expect(renamed.ok).toBe(true)
  if (!renamed.ok) return
  expect(renamed.url.endsWith(".png")).toBe(true)

  // Text bytes labelled as a JPEG are rejected.
  const fake = await savePhoto(fileWithBytes(TEXT, "image/jpeg", "x.jpg"))
  expect(fake).toEqual({ ok: false, error: "wrong_type" })
})

test("rejects empty and non-file uploads as missing", async () => {
  const empty = await savePhoto(
    fileWithBytes(new Uint8Array(), "image/png", "empty.png")
  )
  expect(empty).toEqual({ ok: false, error: "missing" })
  expect(await savePhoto(null as unknown as File)).toEqual({
    ok: false,
    error: "missing",
  })
})

test("rejects files over maxBytes as too_big", async () => {
  const big = new Uint8Array(UPLOAD_RULES.maxBytes + 1)
  big[0] = 0xff
  big[1] = 0xd8
  big[2] = 0xff
  expect(await savePhoto(fileWithBytes(big, "image/jpeg", "big.jpg"))).toEqual(
    { ok: false, error: "too_big" }
  )
})

test("round-trips saved bytes with their content type", async () => {
  const saved = await savePhoto(fileWithBytes(PNG, "image/png", "r.png"))
  expect(saved.ok).toBe(true)
  if (!saved.ok) return
  const name = saved.url.slice("/uploads/".length)
  const photo = await readPhoto(name)
  expect(photo?.type).toBe("image/png")
  expect(Array.from(photo?.bytes.subarray(0, 4) ?? [])).toEqual([0x89, 0x50, 0x4e, 0x47])
})

test("readPhoto rejects paths, wrong extensions and uppercase", async () => {
  expect(await readPhoto("../x.jpg")).toBeNull()
  expect(await readPhoto("a.svg")).toBeNull()
  expect(await readPhoto("a.png/../b.png")).toBeNull()
  const saved = await savePhoto(fileWithBytes(JPEG, "image/jpeg", "u.jpg"))
  expect(saved.ok).toBe(true)
  if (!saved.ok) return
  const name = saved.url.slice("/uploads/".length)
  expect(await readPhoto(name.toUpperCase())).toBeNull()
  expect(await readPhoto("0".repeat(36) + ".jpg")).toBeNull()
})

test("deletePhoto removes its own file, ignores the rest", async () => {
  const saved = await savePhoto(fileWithBytes(JPEG, "image/jpeg", "d.jpg"))
  expect(saved.ok).toBe(true)
  if (!saved.ok) return
  await deletePhoto(saved.url)
  const name = saved.url.slice("/uploads/".length)
  expect(await readPhoto(name)).toBeNull()
  // Second delete ignores "file not found".
  await deletePhoto(saved.url)
  // Foreign urls (Google photos, null, paths) do nothing.
  await deletePhoto("https://lh3.googleusercontent.com/photo.jpg")
  await deletePhoto(null)
  await deletePhoto("/uploads/../secret.jpg")
  expect(readdirSync(dir).length).toBeGreaterThan(0)
})
